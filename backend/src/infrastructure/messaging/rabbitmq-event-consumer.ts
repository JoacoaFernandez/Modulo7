// Consumer de RabbitMQ: lee la cola de CORE (analytics.all-events.v1) y pasa cada mensaje por RecordEventUseCase.
// El usuario del broker sólo puede LEER analytics.*: no se declara nada (ni assertQueue, assertExchange ni bindQueue; un
// assert haría que RabbitMQ cierre el canal), sólo checkQueue (passive), prefetch y consume con ack manual.
// CORE no reintenta un nack y con requeue el mensaje vuelve enseguida, así que NUNCA se hace nack:
//  - Guardado, duplicado o descartado: ack (dedup por eventId en el inbox).
//  - Error permanente (no es JSON, envelope o data inválidos): se guarda en rejected_events (con el motivo y el cuerpo
//    original, para reprocesar), se loguea y se hace ack.
//  - Error transitorio (base caída): reintentos en proceso (1 s, 5 s, 30 s) con el mensaje sin ack. Si siguen fallando
//    se cierra la conexión sin ack: RabbitMQ devuelve a la cola los mensajes sin confirmar y la reconexión con backoff
//    los vuelve a entregar cuando la base responda.
import amqplib from "amqplib";
import { RejectedEventRepository } from "../../domain/repositories/rejected-event.repository";
import { RecordEventUseCase } from "../../application/use-cases/record-event.use-case";
import { EventValidationError } from "../../shared/event-validation-error";

type Connection = Awaited<ReturnType<typeof amqplib.connect>>;
type Channel = Awaited<ReturnType<Connection["createChannel"]>>;
type Message = NonNullable<Parameters<Parameters<Channel["consume"]>[1]>[0]>;

export interface RabbitMqConsumerOptions {
  url: string;
  queue: string;
  prefetch: number;
  maxAttempts: number;
}

// Esperas entre reintentos de un error transitorio (1 s, 5 s, 30 s).
const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];
const MAX_RECONNECT_DELAY_MS = 30_000;

export class RabbitMqEventConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = 1_000;
  private closing = false;
  private connected = false;

  constructor(
    private readonly options: RabbitMqConsumerOptions,
    private readonly recordEvent: RecordEventUseCase,
    private readonly rejected: RejectedEventRepository,
  ) {}

  isConnected(): boolean {
    return this.connected;
  }

  // No bloquea: si el broker no está, reintenta en segundo plano y el server sigue levantado.
  start(): void {
    void this.connect();
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.connected = false;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // Ya estaba cerrado.
    }
    this.channel = null;
    this.connection = null;
  }

  private async connect(): Promise<void> {
    if (this.closing) return;

    try {
      const connection = await amqplib.connect(this.options.url);
      this.connection = connection;
      connection.on("error", (error: Error) => console.error(`[rabbitmq] error de conexión: ${error.message}`));
      connection.on("close", () => {
        // Una conexión ya reemplazada (o cerrada a propósito) no debe tirar abajo a la nueva.
        if (this.connection === connection) this.onDisconnected("se cerró la conexión");
      });

      const channel = await connection.createChannel();
      this.channel = channel;
      channel.on("error", (error: Error) => console.error(`[rabbitmq] error de canal: ${error.message}`));

      // Si la cola no existe, checkQueue falla y cierra el canal: se loguea y se reintenta.
      await channel.checkQueue(this.options.queue);
      await channel.prefetch(this.options.prefetch);
      await channel.consume(this.options.queue, (message) => {
        if (message) void this.handle(channel, message);
      });

      this.connected = true;
      this.reconnectDelayMs = 1_000;
      console.log(`[rabbitmq] consumiendo la cola ${this.options.queue}`);
    } catch (error) {
      console.error(`[rabbitmq] no se pudo consumir ${this.options.queue}: ${describe(error)}`);
      await this.teardown();
      this.scheduleReconnect();
    }
  }

  private onDisconnected(reason: string): void {
    if (this.closing) return;
    console.error(`[rabbitmq] ${reason}`);
    this.connected = false;
    this.channel = null;
    this.connection = null;
    this.scheduleReconnect();
  }

  private async teardown(): Promise<void> {
    this.connected = false;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    try {
      // Sin "close" listener propio disparando otra reconexión: onDisconnected lo ignora si ya hay timer.
      await connection?.close();
    } catch {
      // Ya estaba cerrada.
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;

    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    console.log(`[rabbitmq] reintentando en ${delay / 1000} s`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private async handle(channel: Channel, message: Message): Promise<void> {
    const outcome = await this.process(message.content, () => this.closing || this.channel !== channel);
    if (outcome === "ack") {
      try {
        channel.ack(message);
      } catch (error) {
        // El canal se cerró mientras se procesaba: el broker reentrega el mensaje sin ack.
        console.warn(`[rabbitmq] no se pudo hacer ack del mensaje: ${describe(error)}`);
      }
      return;
    }

    if (outcome === "retry-later" && this.channel === channel) {
      // Sin ack ni nack: al cerrar la conexión el broker devuelve a la cola todo lo que quedó sin confirmar.
      console.error("[rabbitmq] error transitorio persistente: se cierra la conexión y se reconecta con backoff (los mensajes sin ack se reentregan)");
      const connection = this.connection;
      this.onDisconnected("conexión cerrada por error transitorio");
      connection?.close().catch(() => undefined);
    }
  }

  // Procesa el cuerpo de un mensaje (sin tocar el canal): "ack" si hay que confirmarlo (guardado, duplicado, descartado o
  // rechazado y guardado en rejected_events); "retry-later" si el error transitorio persiste o la conexión ya no sirve.
  async process(content: Buffer, isStale: () => boolean = () => this.closing): Promise<"ack" | "retry-later"> {
    const raw = content.toString("utf8");
    let body: unknown;
    let rejection: { reason: string; eventId: string | null } | null = null;
    try {
      body = JSON.parse(raw);
    } catch {
      rejection = { reason: "El mensaje no es JSON.", eventId: null };
    }

    for (let attempt = 1; ; attempt++) {
      try {
        if (!rejection) {
          try {
            const outcome = await this.recordEvent.execute(body);
            if (outcome === "duplicate") console.log("[rabbitmq] evento duplicado (ack)");
            return "ack";
          } catch (error) {
            if (!(error instanceof EventValidationError)) throw error;
            rejection = { reason: error.problems.join(" "), eventId: eventIdOf(body) };
          }
        }

        // Error permanente: reprocesable desde rejected_events. Si guardar falla (base caída) es transitorio.
        await this.rejected.save({ ...rejection, raw });
        console.warn(`[rabbitmq] mensaje rechazado, guardado en rejected_events (ack): ${rejection.reason}`);
        return "ack";
      } catch (error) {
        if (attempt >= this.options.maxAttempts || isStale()) {
          console.error(`[rabbitmq] error transitorio tras ${attempt} intento(s): ${describe(error)}`);
          return "retry-later";
        }

        const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
        console.warn(`[rabbitmq] error transitorio (intento ${attempt}), reintento en ${delay / 1000} s: ${describe(error)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (isStale()) return "retry-later";
      }
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eventId del cuerpo si es un UUID; null si no se pudo leer.
function eventIdOf(body: unknown): string | null {
  const id = typeof body === "object" && body !== null ? (body as { eventId?: unknown }).eventId : undefined;
  return typeof id === "string" && UUID.test(id) ? id : null;
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // ECONNREFUSED llega como AggregateError sin message: se usa el código.
  const code = (error as { code?: string }).code;
  return error.message || code || error.name;
}

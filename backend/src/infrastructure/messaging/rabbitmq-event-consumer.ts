// Consumer de RabbitMQ: lee la cola de CORE (analytics.all-events.v1) y pasa cada mensaje por RecordEventUseCase.
// Ack manual: ack al guardar/descartar/duplicado; nack(requeue=false) → DLQ si el evento es inválido o si el error
// transitorio (DB) persiste tras los reintentos en proceso (CORE v1 §10). La cola la crea CORE: no se declara acá.
import amqplib from "amqplib";
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
      connection.on("close", () => this.onDisconnected("se cerró la conexión"));

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
    let body: unknown;
    try {
      body = JSON.parse(message.content.toString("utf8"));
    } catch {
      console.warn("[rabbitmq] mensaje que no es JSON: va a la DLQ");
      this.settle(channel, message, "nack");
      return;
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const outcome = await this.recordEvent.execute(body);
        this.settle(channel, message, "ack");
        if (outcome === "duplicate") console.log("[rabbitmq] evento duplicado (ack)");
        return;
      } catch (error) {
        if (error instanceof EventValidationError) {
          console.warn(`[rabbitmq] evento inválido, va a la DLQ: ${error.problems.join(" ")}`);
          this.settle(channel, message, "nack");
          return;
        }

        if (attempt >= this.options.maxAttempts || this.closing) {
          console.error(`[rabbitmq] error transitorio tras ${attempt} intento(s), va a la DLQ: ${describe(error)}`);
          this.settle(channel, message, "nack");
          return;
        }

        const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
        console.warn(`[rabbitmq] error transitorio (intento ${attempt}), reintento en ${delay / 1000} s: ${describe(error)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private settle(channel: Channel, message: Message, action: "ack" | "nack"): void {
    try {
      if (action === "ack") channel.ack(message);
      else channel.nack(message, false, false);
    } catch (error) {
      // El canal se cerró mientras se procesaba: el broker reentrega el mensaje sin ack.
      console.warn(`[rabbitmq] no se pudo ${action} el mensaje: ${describe(error)}`);
    }
  }
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // ECONNREFUSED llega como AggregateError sin message: se usa el código.
  const code = (error as { code?: string }).code;
  return error.message || code || error.name;
}

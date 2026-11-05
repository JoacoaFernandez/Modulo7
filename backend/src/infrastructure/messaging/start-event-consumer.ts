// Arranca el consumer de RabbitMQ sólo si hay RABBITMQ_URL; sin ella no hay consumer (modo demo con Postman).
import { RecordEventUseCase } from "../../application/use-cases/record-event.use-case";
import { config } from "../../shared/config";
import { inboxRepository } from "../repositories/inbox-repository.provider";
import { RabbitMqEventConsumer } from "./rabbitmq-event-consumer";

export function startEventConsumer(): RabbitMqEventConsumer | null {
  const { url, queue, prefetch, maxAttempts } = config.rabbitmq;

  if (url === undefined) {
    console.log("[rabbitmq] sin RABBITMQ_URL: el consumer no arranca");
    return null;
  }

  const recordEvent = new RecordEventUseCase(inboxRepository, { storeUnknown: config.events.inboxStoreUnknown });
  const consumer = new RabbitMqEventConsumer({ url, queue, prefetch, maxAttempts }, recordEvent);
  consumer.start();
  return consumer;
}

// Correlation id del request en curso (X-Correlation-Id): los gateways lo propagan a los otros módulos.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const storage = new AsyncLocalStorage<string>();

export function runWithCorrelationId<T>(id: string, fn: () => T): T {
  return storage.run(id, fn);
}

export function currentCorrelationId(): string {
  return storage.getStore() ?? randomUUID();
}

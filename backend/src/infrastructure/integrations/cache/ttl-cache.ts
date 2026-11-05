// Caché en memoria con TTL. Sólo envuelve a las implementaciones HTTP: los mocks nunca cachean.
interface Entry {
  value: unknown;
  expiresAt: number;
}

export class TtlCache {
  private readonly entries = new Map<string, Entry>();

  // Devuelve el valor vigente o ejecuta `load` y lo guarda `ttlSeconds`. Con TTL 0 no cachea.
  // Los fallos no se cachean.
  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    if (ttlSeconds <= 0) return load();

    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;

    const value = await load();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}

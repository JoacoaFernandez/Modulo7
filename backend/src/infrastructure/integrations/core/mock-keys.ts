// Par de claves RSA del CORE mock: se crea al primer arranque en backend/.mock-keys/ (ignorado por git) y se
// reutiliza, para no perder la sesión en cada reinicio de `tsx watch`.
import { createPrivateKey, createPublicKey, generateKeyPairSync, KeyObject } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MOCK_ISSUER = "mock-core";
export const MOCK_KEY_ID = "mock-core-key";

export interface MockKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
}

let cached: MockKeys | null = null;

export function loadMockKeys(): MockKeys {
  if (cached) return cached;

  const dir = path.resolve(process.cwd(), ".mock-keys");
  const privateFile = path.join(dir, "private.pem");
  const publicFile = path.join(dir, "public.pem");

  if (!existsSync(privateFile) || !existsSync(publicFile)) {
    mkdirSync(dir, { recursive: true });
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    writeFileSync(privateFile, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    writeFileSync(publicFile, pair.publicKey.export({ type: "spki", format: "pem" }));
    console.log(`[core-mock] par de claves creado en ${dir}`);
  }

  cached = {
    privateKey: createPrivateKey(readFileSync(privateFile)),
    publicKey: createPublicKey(readFileSync(publicFile)),
  };
  return cached;
}

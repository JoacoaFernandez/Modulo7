// Lectura de los mocks (backend/mocks/<servicio>/**.json). Lee el archivo en CADA llamada: sin caché ni watcher,
// así editar un .json se ve en el próximo request (docs/INTEGRACION.md, sección 5).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GatewayError, GatewayService } from "../../../domain/gateways/gateway-error";

const SAFE_KEY = /^[A-Za-z0-9_-]+$/;

export class MockFileStore {
  private readonly root: string;

  // `mocksDir` es relativa al directorio de trabajo (backend/) salvo que sea absoluta.
  constructor(mocksDir: string) {
    this.root = path.resolve(process.cwd(), mocksDir);
  }

  // Valida una clave que va a formar parte de un nombre de archivo (sin `..`, sin separadores).
  key(service: GatewayService, value: string | number): string {
    const text = String(value);
    if (!SAFE_KEY.test(text)) {
      throw new GatewayError(service, 400, "MOCK_INVALID_KEY", `Clave inválida para un archivo de mock: "${text}". Sólo se aceptan letras, números, "_" y "-".`);
    }
    return text;
  }

  // Contenido del archivo, o undefined si no existe. Un JSON mal formado da 500 con la ruta; un archivo
  // `{ "__mockStatus": 503, "__mockBody": {...} }` simula esa falla.
  async readOptional(service: GatewayService, relativePath: string): Promise<unknown | undefined> {
    const file = path.join(this.root, service, relativePath);

    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new GatewayError(service, 500, "MOCK_READ_ERROR", `No se pudo leer el mock ${file}: ${(error as Error).message}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new GatewayError(service, 500, "MOCK_INVALID_JSON", `El mock ${file} no es un JSON válido: ${(error as Error).message}`);
    }

    if (typeof parsed === "object" && parsed !== null && "__mockStatus" in parsed) {
      const { __mockStatus: status, __mockBody: body } = parsed as { __mockStatus: unknown; __mockBody?: { code?: string; detail?: string; title?: string } };
      const httpStatus = typeof status === "number" ? status : 500;
      throw new GatewayError(service, httpStatus, body?.code ?? "MOCK_FAILURE", body?.detail ?? body?.title ?? `Falla simulada (${httpStatus}) por ${file}`);
    }

    return parsed;
  }

  // Archivo de existencia obligatoria: si falta es un error de configuración (500).
  async readRequired(service: GatewayService, relativePath: string): Promise<unknown> {
    const content = await this.readOptional(service, relativePath);
    if (content === undefined) {
      throw new GatewayError(service, 500, "MOCK_MISSING", `Falta el archivo de mock ${path.join(this.root, service, relativePath)}.`);
    }
    return content;
  }

  // Archivo de un recurso por id: si falta, 404 RESOURCE_NOT_FOUND como el servicio real.
  async readOrNotFound(service: GatewayService, relativePath: string, what: string): Promise<unknown> {
    const content = await this.readOptional(service, relativePath);
    if (content === undefined) throw new GatewayError(service, 404, "RESOURCE_NOT_FOUND", `${what} no encontrado.`);
    return content;
  }
}

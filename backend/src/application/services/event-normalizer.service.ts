// Services: absorbe los formatos que mandan los otros módulos hoy y los lleva al contrato
// oficial de EVENTOS.md antes de validarlos. Es una única capa para los 9 módulos (ver
// INTEGRACION-ACADEMICA.md): no hay un validador especial por emisor. Es pura: no hace I/O.
import { createHash } from "node:crypto";
import { BackofficeSite } from "../../domain/gateways/backoffice-sites.gateway";

// Prefijo del campo `tipo` ("academica.resultado.publicado") → sourceModule oficial.
const MODULE_ALIASES: Record<string, string> = {
  estudiante: "portal-estudiante",
  "portal-estudiante": "portal-estudiante",
  docente: "portal-docente",
  "portal-docente": "portal-docente",
  biblioteca: "biblioteca",
  comedor: "comedor",
  tienda: "tienda",
  eventos: "eventos",
  backoffice: "backoffice",
  academica: "gestion-academica",
  "gestion-academica": "gestion-academica",
  core: "core",
};

// Campos que son de la envoltura; todo lo demás, en el formato viejo, es del payload.
const ENVELOPE_KEYS = new Set(["tipo", "ocurridoEn", "eventId", "sourceModule", "eventType", "occurredAt", "payload"]);

export interface NormalizedEvent {
  body: Record<string, unknown>;
  // true si llegó en el formato viejo (`tipo` + campos sueltos): ahí un campo obligatorio
  // faltante no corta la ingesta, se avisa (el evento se acepta pero no sirve a los tableros).
  isLegacyFormat: boolean;
  warnings: string[];
}

export function normalizeIncomingEvent(raw: unknown, sites: BackofficeSite[]): NormalizedEvent {
  if (!isPlainObject(raw)) return { body: {}, isLegacyFormat: false, warnings: [] };

  const warnings: string[] = [];
  const isLegacyFormat = typeof raw.tipo === "string" && raw.eventType === undefined;
  const body: Record<string, unknown> = isLegacyFormat ? fromLegacyEnvelope(raw, warnings) : { ...raw };

  if (isPlainObject(body.payload)) {
    body.payload = normalizePayload(body.payload, sites, warnings);
  }

  return { body, isLegacyFormat, warnings };
}

// `tipo` + `ocurridoEn` + campos sueltos en la raíz → envelope oficial.
function fromLegacyEnvelope(raw: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  const tipo = raw.tipo as string;
  const dot = tipo.indexOf(".");
  const prefix = dot === -1 ? tipo : tipo.slice(0, dot);
  const eventType = dot === -1 ? "" : tipo.slice(dot + 1);

  const payload = Object.fromEntries(Object.entries(raw).filter(([key]) => !ENVELOPE_KEYS.has(key)));
  const occurredAt = raw.occurredAt ?? raw.ocurridoEn;

  warnings.push(
    `Formato no oficial: se leyó "tipo" como sourceModule + eventType y los campos sueltos como payload. El formato oficial está en EVENTOS.md.`,
  );

  // Un prefijo desconocido se deja tal cual para que la validación lo rechace con 400.
  const sourceModule = MODULE_ALIASES[prefix] ?? prefix;

  // Sin eventId se deriva uno determinístico (nunca aleatorio: rompería la idempotencia),
  // pero se avisa que es provisorio: el emisor tiene que mandar el suyo.
  let eventId = raw.eventId;
  if (eventId === undefined) {
    eventId = `derivado-${createHash("sha256").update(JSON.stringify([tipo, occurredAt, payload])).digest("hex").slice(0, 24)}`;
    warnings.push(`Falta "eventId": se derivó "${eventId as string}" como respaldo. Pedirle al emisor que mande el suyo.`);
  }

  return { eventId, sourceModule, eventType, occurredAt, payload };
}

// Diferencias de formato que se absorben en cualquier envelope, oficial o no.
function normalizePayload(
  original: Record<string, unknown>,
  sites: BackofficeSite[],
  warnings: string[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...original };

  // Los ids son string en todos los módulos; los números (cursoId: 42) se convierten.
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("Id") && typeof value === "number" && Number.isInteger(value)) {
      payload[key] = String(value);
    }
  }

  // Cuatrimestre "2026-2Q" → "2026-2C", el formato de los tableros.
  if (typeof payload.cuatrimestre === "string") {
    payload.cuatrimestre = payload.cuatrimestre.replace(/^(\d{4}-\d)Q$/, "$1C");
  }

  // `sede` (nombre o id del catálogo de Backoffice) → `sedeId`. Si no está en el catálogo
  // no se inventa una sede: queda sin sedeId y el esquema lo marca.
  if (payload.sedeId === undefined && typeof payload.sede === "string") {
    const sede = payload.sede.trim().toLowerCase();
    const site = sites.find((candidate) => candidate.sedeId === sede || candidate.nombre.toLowerCase() === sede);
    if (site) {
      payload.sedeId = site.sedeId;
    } else {
      warnings.push(`La sede "${payload.sede}" no está en el catálogo de Backoffice: no se pudo asignar "sedeId".`);
    }
  }

  // `estado` ("APROBADO") → `aprobado` (boolean).
  if (payload.aprobado === undefined && typeof payload.estado === "string") {
    payload.aprobado = payload.estado.trim().toUpperCase() === "APROBADO";
  }

  return payload;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Validators: turn untrusted HTTP input into the shapes the use cases expect.
import { RecordEventDto } from "../../../application/dtos/analytics.dto";
import { isSourceModule, SOURCE_MODULES } from "../../../domain/entities/event-source.entity";
import { AcademicFilters, FilterOptions, FinancialFilters } from "../../../domain/entities/filters.entity";
import { eventTypesOf } from "../../../domain/entities/event-schemas";
import { validateEventPayload } from "../../../domain/services/event-payload-validator.service";
import { ValidationError } from "../../../shared/validation-error";

type Query = Record<string, unknown>;

// Sin parámetro se usan los defaults del diseño; con un valor desconocido se corta con 400,
// porque devolver otro recorte de datos en silencio es peor que fallar.
export function parseAcademicFilters(query: Query, options: FilterOptions): AcademicFilters {
  return {
    siteName: pickSiteName(query.sedeId, options),
    quarter: pickOption(
      query.cuatrimestre,
      "cuatrimestre",
      options.quarters.map((quarter) => quarter.id),
      options.defaults.quarter,
    ),
  };
}

export function parseFinancialFilters(query: Query, options: FilterOptions): FinancialFilters {
  return {
    siteName: pickSiteName(query.sedeId, options),
    month: pickOption(
      query.periodo,
      "periodo",
      options.months.map((month) => month.id),
      options.defaults.month,
    ),
  };
}

export interface ParsedEvent {
  dto: RecordEventDto;
  warnings: string[];
}

// Recibe el cuerpo ya normalizado (ver event-normalizer.service). `isLegacyFormat` relaja una
// sola regla: en el formato viejo, un campo obligatorio faltante se avisa en vez de cortar.
export function parseRecordEventDto(body: unknown, options: { isLegacyFormat?: boolean } = {}): ParsedEvent {
  if (!isPlainObject(body)) {
    throw new ValidationError("El cuerpo del evento debe ser un objeto JSON.");
  }

  if (!isSourceModule(body.sourceModule)) {
    throw new ValidationError(
      `"sourceModule" inválido. Módulos admitidos: ${SOURCE_MODULES.join(", ")}.`,
    );
  }

  const payload = body.payload ?? {};
  if (!isPlainObject(payload)) {
    throw new ValidationError('"payload" debe ser un objeto JSON.');
  }

  const eventType = requireText(body.eventType, "eventType");

  // Cada módulo solo puede mandar los eventos de su catálogo, con el payload que declara
  // EVENTOS.md (tipos incluidos). Un evento fuera de catálogo se rechaza en vez de guardarse
  // en silencio: ningún tablero sabría leerlo.
  const problems = validateEventPayload(body.sourceModule, eventType, payload);
  if (problems === null) {
    throw new ValidationError(
      `"eventType" "${eventType}" no existe para "${body.sourceModule}". Eventos admitidos: ${eventTypesOf(body.sourceModule).join(", ") || "ninguno"}.`,
    );
  }

  const warnings: string[] = [];
  const blocking = options.isLegacyFormat ? problems.invalid : [...problems.missing, ...problems.invalid];
  if (blocking.length > 0) {
    throw new ValidationError(`Payload inválido: ${blocking.join(" ")}`);
  }
  if (options.isLegacyFormat && problems.missing.length > 0) {
    warnings.push(
      `Se aceptó incompleto, pero no alimenta los tableros hasta que el emisor mande: ${problems.missing.join(" ")}`,
    );
  }

  return {
    dto: {
      eventId: requireText(body.eventId, "eventId"),
      sourceModule: body.sourceModule,
      eventType,
      occurredAt: requireTimestamp(body.occurredAt, "occurredAt"),
      payload,
    },
    warnings,
  };
}

// La sede viaja como id del catálogo de Backoffice (?sedeId=sede-centro), nunca como nombre.
// Internamente los tableros siguen resolviendo por nombre de sede.
function pickSiteName(raw: unknown, options: FilterOptions): string {
  if (raw === undefined) return options.defaults.siteName;

  const site = options.sites.find((candidate) => candidate.id === raw);
  if (!site) {
    throw new ValidationError(
      `Valor inválido para "sedeId". Opciones: ${options.sites.map((candidate) => candidate.id).join(" · ")}.`,
    );
  }

  return site.name;
}

function pickOption(raw: unknown, param: string, allowed: string[], fallback: string): string {
  if (raw === undefined) return fallback;

  if (typeof raw !== "string" || !allowed.includes(raw)) {
    throw new ValidationError(
      `Valor inválido para "${param}". Opciones: ${allowed.join(" · ")}.`,
    );
  }

  return raw;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`"${field}" es obligatorio y debe ser un texto no vacío.`);
  }

  return value;
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`"${field}" debe ser una fecha ISO 8601 válida.`);
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

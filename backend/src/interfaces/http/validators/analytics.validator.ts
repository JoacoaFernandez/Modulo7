// Validators: turn untrusted HTTP input into the shapes the use cases expect.
import { RecordEventDto } from "../../../application/dtos/analytics.dto";
import { isSourceModule, SOURCE_MODULES } from "../../../domain/entities/event-source.entity";
import { AcademicFilters, FilterOptions, FinancialFilters } from "../../../domain/entities/filters.entity";
import { ValidationError } from "../../../shared/validation-error";

type Query = Record<string, unknown>;

// Sin parámetro se usan los defaults del diseño; con un valor desconocido se corta con 400,
// porque devolver otro recorte de datos en silencio es peor que fallar.
export function parseAcademicFilters(query: Query, options: FilterOptions): AcademicFilters {
  return {
    siteName: pickOption(
      query.sede,
      "sede",
      options.sites.map((site) => site.name),
      options.defaults.siteName,
    ),
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
    siteName: pickOption(
      query.sede,
      "sede",
      options.sites.map((site) => site.name),
      options.defaults.siteName,
    ),
    month: pickOption(
      query.periodo,
      "periodo",
      options.months.map((month) => month.id),
      options.defaults.month,
    ),
  };
}

export function parseRecordEventDto(body: unknown): RecordEventDto {
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

  return {
    eventId: requireText(body.eventId, "eventId"),
    sourceModule: body.sourceModule,
    eventType: requireText(body.eventType, "eventType"),
    occurredAt: requireTimestamp(body.occurredAt, "occurredAt"),
    payload,
  };
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

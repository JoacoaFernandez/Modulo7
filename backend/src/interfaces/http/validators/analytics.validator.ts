// Validators: turn untrusted HTTP input into the shapes the use cases expect.
import { AcademicFilters, FilterOptions, FinancialFilters } from "../../../domain/entities/filters.entity";
import { DEFAULT_EVENTS_LIMIT } from "../../../application/use-cases/list-events.use-case";
import { AGGREGATE_SITE } from "../../../domain/entities/site.entity";
import { ValidationError } from "../../../shared/validation-error";

type Query = Record<string, unknown>;

// Sin parámetro se usan los defaults del diseño; con un valor desconocido se corta con 400,
// porque devolver otro recorte de datos en silencio es peor que fallar.
export function parseAcademicFilters(query: Query, options: FilterOptions): AcademicFilters {
  return {
    siteId: pickSiteId(query.sedeId, options),
    quarter: pickOption(
      query.cuatrimestre,
      "cuatrimestre",
      options.quarters.map((quarter) => quarter.id),
      options.defaults.quarter,
      // Si Gestión Académica no respondió, el catálogo de cuatrimestres es sólo el actual: se acepta uno bien formado.
      failed(options, "academic") && typeof query.cuatrimestre === "string" && /^\d{4}-[12]C$/.test(query.cuatrimestre),
    ),
    facultyId: pickFacultyId(query.facultad, options),
  };
}

export function parseFinancialFilters(query: Query, options: FilterOptions): FinancialFilters {
  return {
    siteId: pickSiteId(query.sedeId, options),
    month: pickOption(
      query.periodo,
      "periodo",
      options.months.map((month) => month.id),
      options.defaults.month,
    ),
  };
}

// Paginación del listado de depuración de eventos: ?limit=50&cursor=... (el cursor es opaco).
export function parseEventsPage(query: Query): { limit: number; cursor: string | null } {
  let limit = DEFAULT_EVENTS_LIMIT;
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1) throw new ValidationError('"limit" debe ser un entero positivo.');
  }

  if (query.cursor !== undefined && (typeof query.cursor !== "string" || query.cursor === "")) {
    throw new ValidationError('"cursor" inválido.');
  }

  return { limit, cursor: (query.cursor as string | undefined) ?? null };
}

// La sede viaja como id del catálogo (?sedeId=sede-centro), nunca como nombre; sin parámetro, la agregada.
function pickSiteId(raw: unknown, options: FilterOptions): string {
  if (raw === undefined) return AGGREGATE_SITE.id;

  const site = options.sites.find((candidate) => candidate.id === raw);
  // Backoffice caído: el catálogo trae sólo "Todas las sedes"; se acepta el id y el tablero sale con aviso.
  if (!site && failed(options, "backoffice") && typeof raw === "string" && raw !== "") return raw;
  if (!site) {
    throw new ValidationError(
      `Valor inválido para "sedeId". Opciones: ${options.sites.map((candidate) => candidate.id).join(" · ")}.`,
    );
  }

  return site.id;
}

// La facultad viaja como id del catálogo (?facultad=...); sin parámetro, todas (null).
function pickFacultyId(raw: unknown, options: FilterOptions): string | null {
  if (raw === undefined) return null;

  const faculty = options.faculties.find((candidate) => candidate.id === raw);
  if (!faculty && failed(options, "academic") && typeof raw === "string" && raw !== "") return raw;
  if (!faculty) {
    throw new ValidationError(
      `Valor inválido para "facultad". Opciones: ${options.faculties.map((candidate) => candidate.id).join(" · ") || "ninguna"}.`,
    );
  }

  return faculty.id;
}

// ¿Falló esa fuente al armar los catálogos? Entonces su lista de opciones viene reducida y no sirve para rechazar un valor.
function failed(options: FilterOptions, source: "backoffice" | "academic"): boolean {
  return options.warnings?.some((warning) => warning.source === source) ?? false;
}

function pickOption(raw: unknown, param: string, allowed: string[], fallback: string, accept = false): string {
  if (raw === undefined) return fallback;
  if (accept) return raw as string;

  if (typeof raw !== "string" || !allowed.includes(raw)) {
    throw new ValidationError(
      `Valor inválido para "${param}". Opciones: ${allowed.join(" · ")}.`,
    );
  }

  return raw;
}

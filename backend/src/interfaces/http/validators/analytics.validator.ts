// Validators: turn untrusted HTTP input into the shapes the use cases expect.
import { AcademicFilters, FilterOptions, FinancialFilters } from "../../../domain/entities/filters.entity";
import { ValidationError } from "../../../shared/validation-error";

type Query = Record<string, unknown>;

// Sin parámetro se usan los defaults del diseño; con un valor desconocido se corta con 400,
// porque devolver otro recorte de datos en silencio es peor que fallar.
export function parseAcademicFilters(query: Query, options: FilterOptions): AcademicFilters {
  return {
    siteId: pickSiteId(query.siteId, options),
    termId: pickOption(
      query.termId,
      "termId",
      options.quarters.map((quarter) => quarter.id),
      options.defaults.termId,
    ),
  };
}

export function parseFinancialFilters(query: Query, options: FilterOptions): FinancialFilters {
  return {
    siteId: pickSiteId(query.siteId, options),
    month: pickOption(
      query.month,
      "month",
      options.months.map((month) => month.id),
      options.defaults.month,
    ),
  };
}

// La sede viaja como siteId (UUID del catálogo de Backoffice), nunca como nombre. Sin
// siteId se muestran todas las sedes.
function pickSiteId(raw: unknown, options: FilterOptions): string | null {
  if (raw === undefined || raw === "") return options.defaults.siteId;

  const site = options.sites.find((candidate) => candidate.id !== null && candidate.id === raw);
  if (!site) {
    const valid = options.sites.flatMap((candidate) => (candidate.id ? [`${candidate.id} (${candidate.code})`] : []));
    throw new ValidationError(`Valor inválido para "siteId". Opciones: ${valid.join(" · ")}.`);
  }

  return site.id;
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

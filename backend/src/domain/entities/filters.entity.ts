// Domain entities: core business objects, independent of frameworks and infrastructure.
import { Period } from "./period.entity";
import { Site } from "./site.entity";

// Filtros del tablero académico: ?siteId=&termId=. siteId null = todas las sedes.
export interface AcademicFilters {
  siteId: string | null;
  termId: string;
}

// Filtros del tablero financiero y del de eventos: ?siteId=&month=AAAA-MM
export interface FinancialFilters {
  siteId: string | null;
  month: string;
}

export interface FilterDefaults {
  siteId: string | null;
  termId: string;
  month: string;
}

// Lo que expone GET /api/v1/filters para alimentar los selectores del header.
export interface FilterOptions {
  sites: Site[];
  quarters: Period[];
  months: Period[];
  defaults: FilterDefaults;
}

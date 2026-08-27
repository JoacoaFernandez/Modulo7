// Domain entities: core business objects, independent of frameworks and infrastructure.
import { Period } from "./period.entity";
import { Site } from "./site.entity";

// Filtros del tablero académico: ?sede=&cuatrimestre=
export interface AcademicFilters {
  siteName: string;
  quarter: string;
}

// Filtros del tablero financiero y del de eventos: ?sede=&periodo=
export interface FinancialFilters {
  siteName: string;
  month: string;
}

export interface FilterDefaults {
  siteName: string;
  quarter: string;
  month: string;
}

// Lo que expone GET /api/analytics/filters para alimentar los selectores del header.
export interface FilterOptions {
  sites: Site[];
  quarters: Period[];
  months: Period[];
  defaults: FilterDefaults;
}

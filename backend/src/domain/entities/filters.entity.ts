// Domain entities: core business objects, independent of frameworks and infrastructure.
import { DashboardWarning } from "./dashboard-warning.entity";
import { Period } from "./period.entity";
import { Site } from "./site.entity";

// Filtros del tablero académico: ?sedeId=&cuatrimestre=&facultad=
export interface AcademicFilters {
  siteId: string;
  quarter: string;
  // Id de la facultad del catálogo; null = todas las facultades.
  facultyId: string | null;
}

// Filtros del tablero financiero y del de eventos: ?sede=&periodo=
export interface FinancialFilters {
  siteId: string;
  month: string;
}

// Facultad del catálogo de filtros. Hoy el id es el propio nombre (Gestión Académica sólo manda `facultad` como
// texto en curso.abierto); si algún día llega un id real, el contrato ya separa uno del otro.
export interface Faculty {
  id: string;
  name: string;
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
  faculties: Faculty[];
  defaults: FilterDefaults;
  // Fuentes que fallaron al armar los catálogos (la lista afectada va reducida).
  warnings?: DashboardWarning[];
}

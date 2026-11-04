// Configuración estática de los tableros: colores, etiquetas y límites que no salen de eventos.
import { SourceModule } from "../../domain/entities/event-source.entity";

// Cantidad de períodos de las series de los gráficos (cuatrimestres de facultades, meses de balance y eventos).
export const SERIES_LENGTH = 6;

export const TOP_PRODUCTS_LIMIT = 6;

// Categorías de gastos administrativos, en el orden en que se apilan en la barra.
export const EXPENSE_CATEGORIES: readonly { category: string; color: string }[] = [
  { category: "Salarios docentes", color: "#1A2B48" },
  { category: "Salarios administrativos", color: "#2D5DA1" },
  { category: "Servicios e infraestructura", color: "#4B79B8" },
  { category: "Mantenimiento y obras", color: "#6D94C7" },
  { category: "Licencias y sistemas", color: "#94B2D8" },
  { category: "Becas y bonificaciones", color: "#BACDE7" },
  { category: "Otros gastos operativos", color: "#DCE5F1" },
];

export const OTHER_EXPENSES_CATEGORY = "Otros gastos operativos";

// Colores de las series por facultad; se asignan por orden alfabético de facultad (y se reciclan).
export const FACULTY_COLORS: readonly string[] = ["#2D5DA1", "#127453", "#1A2B48", "#B7791F", "#7A3E9D", "#C2410C"];

// Módulos que pueden alimentar cada tablero (ver "Qué evento alimenta qué tablero" en EVENTOS.md).
// La nota al pie muestra solo los que ya mandaron eventos.
export const ACADEMIC_FEEDERS: readonly SourceModule[] = ["gestion-academica", "portal-estudiante", "portal-docente", "backoffice"];
export const FINANCIAL_FEEDERS: readonly SourceModule[] = ["core", "backoffice", "tienda", "comedor"];
export const EVENTS_FEEDERS: readonly SourceModule[] = ["eventos"];

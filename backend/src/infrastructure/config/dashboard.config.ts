// Configuración estática de los tableros: colores, etiquetas y límites que no salen de eventos.
import { SourceModule } from "../../domain/entities/event-source.entity";

// Cantidad de períodos de las series de los gráficos (cuatrimestres de facultades, meses de balance y eventos).
export const SERIES_LENGTH = 6;

export const TOP_PRODUCTS_LIMIT = 6;

// Conceptos de `aggregates` de CORE (docs/INTEGRACION.md, 6.2). Definiciones a validar con el equipo y la cátedra:
// ingresos = cobros de servicios (DEBIT) menos devoluciones (REVERSAL, mínimo 0); egresos = acreditaciones de sueldos
// y becas (CREDIT). TOP_UP y ADJUSTMENT no entran (saldo cargado, no ingreso).
export const INCOME_CONCEPTS: readonly string[] = ["STORE_PURCHASE", "DINING_RESERVATION", "LIBRARY_FINE", "EVENT_REGISTRATION"];
export const REVERSAL_CONCEPTS: readonly string[] = ["REFUND"];

// Egresos que además se muestran como "gastos administrativos", en el orden en que se apilan en la barra.
export const EXPENSE_CONCEPTS: readonly { key: string; category: string; color: string }[] = [
  { key: "PAYROLL", category: "Sueldos", color: "#1A2B48" },
  { key: "SCHOLARSHIP", category: "Becas y bonificaciones", color: "#4B79B8" },
];

// Colores de las series por facultad; se asignan por orden alfabético de facultad (y se reciclan).
export const FACULTY_COLORS: readonly string[] = ["#2D5DA1", "#127453", "#1A2B48", "#B7791F", "#7A3E9D", "#C2410C"];

// Módulos que pueden alimentar cada tablero (ver "Qué evento alimenta qué tablero" en EVENTOS.md).
// La nota al pie muestra solo los que ya mandaron eventos, y la última ingesta es la de esos módulos.
export const ACADEMIC_FEEDERS: readonly SourceModule[] = ["gestion-academica", "backoffice"];
export const FINANCIAL_FEEDERS: readonly SourceModule[] = ["core", "backoffice", "tienda", "comedor"];
export const EVENTS_FEEDERS: readonly SourceModule[] = ["eventos", "backoffice"];

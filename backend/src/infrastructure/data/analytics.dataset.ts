// Mock data: datasets del prototipo «Analítica Institucional», portados 1:1 desde el diseño.
// Mientras no haya base de datos, esta es la única fuente de datos del backend.
import { AnalyticsDataset } from "../../domain/entities/analytics-dataset.entity";
import { EventSource, SOURCE_MODULES } from "../../domain/entities/event-source.entity";
import { Period } from "../../domain/entities/period.entity";
import { Role } from "../../domain/entities/role.entity";
import { Site } from "../../domain/entities/site.entity";

// Literal del prototipo: "Última ingesta de eventos: 26/08 04:12".
const LAST_INGESTION_AT = "2026-08-26T04:12:00.000-03:00";

const SITES: Site[] = [
  {
    id: "todas-las-sedes",
    name: "Todas las sedes",
    studentsCount: 6842,
    subjectsCount: 148,
    commissionsCount: 312,
    teachersCount: 214,
    rateAdjustment: 0,
    isAggregate: true,
  },
  {
    id: "sede-centro",
    name: "Sede Centro",
    studentsCount: 3915,
    subjectsCount: 96,
    commissionsCount: 183,
    teachersCount: 131,
    rateAdjustment: 1,
    isAggregate: false,
  },
  {
    id: "sede-belgrano",
    name: "Sede Belgrano",
    studentsCount: 2704,
    subjectsCount: 74,
    commissionsCount: 141,
    teachersCount: 102,
    rateAdjustment: 3,
    isAggregate: false,
  },
  {
    id: "sede-pilar",
    name: "Sede Pilar",
    studentsCount: 1988,
    subjectsCount: 58,
    commissionsCount: 102,
    teachersCount: 79,
    rateAdjustment: -2,
    isAggregate: false,
  },
  {
    id: "campus-online",
    name: "Campus Online",
    studentsCount: 1466,
    subjectsCount: 41,
    commissionsCount: 66,
    teachersCount: 48,
    rateAdjustment: -5,
    isAggregate: false,
  },
];

const QUARTERS: Period[] = ["2023-2C", "2024-1C", "2024-2C", "2025-1C", "2025-2C", "2026-1C"].map(
  (id, index) => ({ id, label: id, kind: "quarter", index }),
);

const MONTHS: Period[] = ["Mar 2026", "Abr 2026", "May 2026", "Jun 2026", "Jul 2026", "Ago 2026"].map(
  (id, index) => ({ id, label: id, kind: "month", index }),
);

const MODULE_LABELS: Record<(typeof SOURCE_MODULES)[number], string> = {
  academica: "académica",
  inscripciones: "inscripciones",
  evaluaciones: "evaluaciones",
  docencia: "docencia",
  finanzas: "finanzas",
  biblioteca: "biblioteca",
  campus: "campus",
  soporte: "soporte",
  identidad: "identidad",
};

const EVENT_SOURCES: EventSource[] = SOURCE_MODULES.map((module) => ({
  module,
  label: MODULE_LABELS[module],
  status: "connected",
  lastIngestionAt: LAST_INGESTION_AT,
}));

const ROLES: Role[] = [
  {
    id: "academica",
    name: "Dirección Académica",
    initials: "DA",
    description: "Rendimiento por materia, docente y sede",
    availableDashboards: ["academic"],
  },
  {
    id: "financiera",
    name: "Dirección Financiera",
    initials: "DF",
    description: "Balance, gastos, tienda, comedores y eventos",
    availableDashboards: ["financial", "events"],
  },
];

export const ANALYTICS_DATASET: AnalyticsDataset = {
  baselineStudentsCount: 6842,
  sites: SITES,
  quarters: QUARTERS,
  months: MONTHS,

  subjects: [
    { code: "AM-101", name: "Análisis Matemático I", approvalRates: [52, 55, 54, 58, 57, 61] },
    { code: "ALG-102", name: "Álgebra", approvalRates: [61, 63, 60, 64, 66, 68] },
    { code: "EST-210", name: "Estadística", approvalRates: [58, 60, 63, 62, 65, 64] },
    { code: "PRG-105", name: "Programación I", approvalRates: [70, 72, 74, 73, 76, 78] },
    { code: "CON-110", name: "Contabilidad Básica", approvalRates: [66, 68, 67, 70, 71, 73] },
    { code: "SO-320", name: "Sistemas Operativos", approvalRates: [72, 70, 74, 76, 75, 79] },
    { code: "BDD-310", name: "Base de Datos", approvalRates: [77, 79, 78, 81, 82, 84] },
    { code: "DPR-140", name: "Derecho Privado", approvalRates: [80, 82, 81, 84, 83, 86] },
  ],

  teachers: [
    { name: "Molina, Rodrigo", subjectName: "Base de Datos", approvalRate: 91, delta: 2.1 },
    { name: "Ferreyra, Carla", subjectName: "Derecho Privado", approvalRate: 88, delta: 0.4 },
    { name: "Sánchez, Leandro", subjectName: "Programación I", approvalRate: 84, delta: -1.2 },
    { name: "Bianchi, Mariana", subjectName: "Sistemas Operativos", approvalRate: 81, delta: 3.0 },
    { name: "Godoy, Andrés", subjectName: "Contabilidad Básica", approvalRate: 77, delta: -0.8 },
    { name: "Kessler, Paula", subjectName: "Álgebra", approvalRate: 74, delta: 1.6 },
    { name: "Ibáñez, Sofía", subjectName: "Estadística", approvalRate: 68, delta: -2.4 },
    { name: "Duarte, Nicolás", subjectName: "Análisis Matemático I", approvalRate: 61, delta: -4.1 },
  ],

  faculties: [
    { name: "Ingeniería y Tecnología", color: "#2D5DA1", approvalRates: [69, 71, 68, 72, 74, 75] },
    { name: "Ciencias Económicas", color: "#127453", approvalRates: [76, 78, 77, 79, 80, 81] },
    { name: "Derecho", color: "#1A2B48", approvalRates: [82, 80, 83, 81, 84, 83] },
  ],

  finance: {
    balance: [1042.3, 1188.6, 1361.4, 1497.2, 1644.5, 1842.9],
    income: [2118.4, 2205.7, 2264.1, 2301.8, 2352.6, 2394.7],
    expenses: [1989.5, 2059.4, 2091.3, 2166.0, 2205.3, 2196.3],
  },

  expenseCategories: [
    { category: "Salarios docentes", percentage: 46.2, color: "#1A2B48" },
    { category: "Salarios administrativos", percentage: 18.4, color: "#2D5DA1" },
    { category: "Servicios e infraestructura", percentage: 11.0, color: "#4B79B8" },
    { category: "Mantenimiento y obras", percentage: 7.3, color: "#6D94C7" },
    { category: "Licencias y sistemas", percentage: 6.1, color: "#94B2D8" },
    { category: "Becas y bonificaciones", percentage: 5.8, color: "#BACDE7" },
    { category: "Otros gastos operativos", percentage: 5.2, color: "#DCE5F1" },
  ],

  products: [
    { name: "Buzo institucional", category: "Indumentaria", unitsSold: 612, revenue: 27.5 },
    { name: "Kit de laboratorio", category: "Insumos", unitsSold: 264, revenue: 12.1 },
    { name: "Botella térmica 750 ml", category: "Merchandising", unitsSold: 438, revenue: 10.5 },
    { name: "Apunte Análisis Matemático I", category: "Apuntes", unitsSold: 1284, revenue: 9.6 },
    { name: "Café en grano 250 g", category: "Cafetería", unitsSold: 1940, revenue: 7.8 },
    { name: "Cuaderno A4 tapa dura", category: "Librería", unitsSold: 1106, revenue: 6.2 },
  ],

  dining: [
    { siteName: "Sede Centro", revenue: 84.2, ticketsCount: 41300, averageTicket: 2039, delta: 3.4 },
    { siteName: "Sede Belgrano", revenue: 61.7, ticketsCount: 29800, averageTicket: 2070, delta: 1.1 },
    { siteName: "Sede Pilar", revenue: 38.4, ticketsCount: 18100, averageTicket: 2121, delta: -2.6 },
    {
      siteName: "Campus Online",
      revenue: 0,
      ticketsCount: 0,
      averageTicket: 0,
      delta: 0,
      note: "Sin servicio de comedor",
    },
  ],

  eventMonths: [
    { month: "Mar 2026", eventsCount: 38, attendeesCount: 5120, attendanceRate: 66 },
    { month: "Abr 2026", eventsCount: 44, attendeesCount: 6340, attendanceRate: 69 },
    { month: "May 2026", eventsCount: 41, attendeesCount: 5880, attendanceRate: 71 },
    { month: "Jun 2026", eventsCount: 36, attendeesCount: 4910, attendanceRate: 68 },
    { month: "Jul 2026", eventsCount: 22, attendeesCount: 2740, attendanceRate: 63 },
    { month: "Ago 2026", eventsCount: 51, attendeesCount: 8120, attendanceRate: 70 },
  ],

  eventTypes: [
    { eventType: "Clases magistrales abiertas", frequency: 18, attendeesCount: 142, attendanceRate: 74 },
    { eventType: "Talleres de empleabilidad", frequency: 11, attendeesCount: 86, attendanceRate: 81 },
    { eventType: "Seminarios de posgrado", frequency: 9, attendeesCount: 64, attendanceRate: 88 },
    { eventType: "Actividades culturales", frequency: 7, attendeesCount: 218, attendanceRate: 57 },
    { eventType: "Jornadas de investigación", frequency: 4, attendeesCount: 310, attendanceRate: 68 },
    { eventType: "Ferias y expo carreras", frequency: 2, attendeesCount: 1240, attendanceRate: 63 },
  ],

  roles: ROLES,
  eventSources: EVENT_SOURCES,

  defaults: {
    siteName: "Todas las sedes",
    quarter: "2026-1C",
    month: "Ago 2026",
  },

  lastIngestionAt: LAST_INGESTION_AT,
  academicSourceModules: ["academica", "docencia", "evaluaciones"],
  financialSourceModules: ["finanzas", "campus"],
  eventsSourceModules: ["academica", "campus"],
};

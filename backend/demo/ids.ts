// Ids y catálogos compartidos del entorno de demo (docs/INTEGRACION.md, 5.3). Los usan el seed de eventos
// (prisma/demo-seed.ts), el generador de mocks (scripts/generate-demo-mocks.ts), el verificador (scripts/check-mocks.ts)
// y la colección de Postman: así un siteId, courseId, subjectId o periodId significa lo mismo en los eventos y en los mocks.
// Todo es determinístico: los UUID son fijos (ver demoUuid) y no cambian entre corridas.

// ---------------------------------------------------------------------------------------------
// UUID fijos
// ---------------------------------------------------------------------------------------------

const KIND_CODES = {
  student: 1,
  teacher: 2,
  location: 3,
  product: 4,
  reservation: 5,
  purchase: 6,
  registration: 7,
  event: 8,
  user: 9,
} as const;

export type DemoUuidKind = keyof typeof KIND_CODES;

// UUID v4 fijo para la entidad `kind` número `n`: los dos primeros dígitos identifican el tipo y el resto es `n` en hex.
export function demoUuid(kind: DemoUuidKind, n: number): string {
  const code = String(KIND_CODES[kind]).padStart(2, "0");
  return `${code}d00000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

// Prefijo de los eventId de los envelopes demo (derivados de una clave estable, ver demo/dataset.ts): permite que
// `db:demo:clear` borre sólo lo que sembró el demo y no los eventos que llegaron por Postman o por la cola.
export const DEMO_EVENT_ID_PREFIX = "de0de0de";

// ---------------------------------------------------------------------------------------------
// Sedes (Backoffice) y sus equivalentes en Gestión Académica
// ---------------------------------------------------------------------------------------------

export type SiteKey = "monserrat" | "belgrano" | "pilar" | "online" | "rosario";

export interface DemoSite {
  key: SiteKey;
  // siteId de Backoffice (UUID); es el `backofficeSiteId` de Gestión Académica.
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  province: string | null;
  status: "ACTIVE" | "INACTIVE";
  // id numérico de la sede en Gestión Académica (sin valor: la sede no dicta cursos).
  academicId: number | null;
  // Letra con la que los catálogos de materias dicen en qué sedes se dicta cada una.
  letter: "C" | "B" | "P" | "O" | "R";
  // Comedor: las sedes sin servicio se ven con la nota "Sin reservas de comedor registradas".
  hasDining: boolean;
}

export const SITES: readonly DemoSite[] = [
  { key: "monserrat", id: "3e9b0a12-55cc-4d77-9a01-6b2f8c4e1d90", code: "MONSERRAT", name: "Sede Monserrat", address: "Lima 775", city: "CABA", province: null, status: "ACTIVE", academicId: 1, letter: "C", hasDining: true },
  { key: "belgrano", id: "b1e4d7a3-6c20-4f95-8a3d-0e9c5b2f7a14", code: "BELGRANO", name: "Sede Belgrano", address: "Av. Cabildo 2040", city: "CABA", province: null, status: "ACTIVE", academicId: 3, letter: "B", hasDining: true },
  { key: "pilar", id: "7a41c2d8-0b6e-4f53-8d19-5e2a9c0f1b37", code: "PILAR", name: "Sede Pilar", address: "Ruta 8 km 61", city: "Pilar", province: "Buenos Aires", status: "ACTIVE", academicId: 2, letter: "P", hasDining: true },
  { key: "online", id: "c5f8a2e0-93b4-4d1a-b7e6-2a0d9c4f8b61", code: "ONLINE", name: "Campus Online", address: "Virtual", city: "CABA", province: null, status: "ACTIVE", academicId: 4, letter: "O", hasDining: false },
  // Sede cerrada: no entra en el filtro de sedes (sólo ACTIVE), pero sigue existiendo en Backoffice.
  { key: "rosario", id: "e0a7b3c9-4d18-4e62-9f05-7c1b8d3a6e92", code: "ROSARIO", name: "Sede Rosario", address: "Pellegrini 1200", city: "Rosario", province: "Santa Fe", status: "INACTIVE", academicId: null, letter: "R", hasDining: false },
];

export const SITE_BY_KEY: Record<SiteKey, DemoSite> = Object.fromEntries(SITES.map((site) => [site.key, site])) as Record<SiteKey, DemoSite>;
export const ACTIVE_SITES = SITES.filter((site) => site.status === "ACTIVE");
export const DINING_SITES = SITES.filter((site) => site.hasDining);

// ---------------------------------------------------------------------------------------------
// Locaciones (backoffice.location.upserted.v1)
// ---------------------------------------------------------------------------------------------

export interface DemoLocation {
  id: string;
  siteKey: SiteKey;
  name: string;
  capacity: number;
  type: string;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
}

export const LOCATIONS: readonly DemoLocation[] = [
  { id: demoUuid("location", 1), siteKey: "monserrat", name: "Aula Magna", capacity: 350, type: "AUDITORIO", status: "ACTIVE" },
  { id: demoUuid("location", 2), siteKey: "monserrat", name: "Auditorio Lima", capacity: 150, type: "AUDITORIO", status: "ACTIVE" },
  { id: demoUuid("location", 3), siteKey: "monserrat", name: "Sala de Talleres", capacity: 40, type: "AULA", status: "ACTIVE" },
  { id: demoUuid("location", 4), siteKey: "belgrano", name: "Auditorio Belgrano", capacity: 180, type: "AUDITORIO", status: "ACTIVE" },
  { id: demoUuid("location", 5), siteKey: "belgrano", name: "Aula 3B", capacity: 45, type: "AULA", status: "MAINTENANCE" },
  { id: demoUuid("location", 6), siteKey: "pilar", name: "SUM Pilar", capacity: 120, type: "SUM", status: "ACTIVE" },
  { id: demoUuid("location", 7), siteKey: "pilar", name: "Aula Taller Pilar", capacity: 35, type: "AULA", status: "ACTIVE" },
  { id: demoUuid("location", 8), siteKey: "rosario", name: "Salón Rosario", capacity: 90, type: "SUM", status: "INACTIVE" },
];

// Locación que NUNCA recibe un backoffice.location.upserted.v1: el evento que la usa no tiene sede y sólo cuenta en
// "Todas las sedes" (caso borde de docs/INTEGRACION.md, 6.3).
export const UNKNOWN_LOCATION_ID = demoUuid("location", 99);

// ---------------------------------------------------------------------------------------------
// Gestión Académica: períodos, carreras, planes y asignaturas (ids numéricos, como en G9)
// ---------------------------------------------------------------------------------------------

export interface DemoPeriod {
  id: number;
  anio: number;
  numero: 1 | 2;
  fechaInicio: string;
  fechaFin: string;
  // "2026-2C": la etiqueta que usan los tableros.
  label: string;
  // Posición cronológica (0 = el más viejo).
  index: number;
}

const period = (id: number, anio: number, numero: 1 | 2, fechaInicio: string, fechaFin: string): Omit<DemoPeriod, "index"> => ({
  id, anio, numero, fechaInicio, fechaFin, label: `${anio}-${numero}C`,
});

export const PERIODS: readonly DemoPeriod[] = [
  period(3, 2024, 1, "2024-03-11", "2024-07-12"),
  period(4, 2024, 2, "2024-08-05", "2024-12-13"),
  period(5, 2025, 1, "2025-03-10", "2025-07-11"),
  period(6, 2025, 2, "2025-08-04", "2025-12-12"),
  period(7, 2026, 1, "2026-03-09", "2026-07-11"),
  period(8, 2026, 2, "2026-08-10", "2026-12-12"),
].map((value, index) => ({ ...value, index }));

export const CURRENT_PERIOD = PERIODS[PERIODS.length - 1];

export interface DemoCareer {
  id: number;
  codigo: string;
  nombre: string;
  facultad: string;
  duracion: number;
  titulo: string;
  // Sesgo de la tasa de aprobación de la facultad, en puntos porcentuales.
  rateDelta: number;
  // Peso de la facultad en la población estudiantil.
  share: number;
}

export const CAREERS: readonly DemoCareer[] = [
  { id: 1, codigo: "ISI", nombre: "Ingeniería en Sistemas de Información", facultad: "Ingeniería y Tecnología", duracion: 5, titulo: "Ingeniero/a en Sistemas de Información", rateDelta: -3, share: 0.27 },
  { id: 2, codigo: "LAE", nombre: "Licenciatura en Administración de Empresas", facultad: "Ciencias Económicas", duracion: 4, titulo: "Licenciado/a en Administración de Empresas", rateDelta: 0, share: 0.25 },
  { id: 3, codigo: "ABG", nombre: "Abogacía", facultad: "Derecho y Ciencias Sociales", duracion: 5, titulo: "Abogado/a", rateDelta: 1, share: 0.2 },
  { id: 4, codigo: "ARQ", nombre: "Arquitectura", facultad: "Arquitectura y Diseño", duracion: 5, titulo: "Arquitecto/a", rateDelta: 2, share: 0.12 },
  { id: 5, codigo: "PSI", nombre: "Licenciatura en Psicología", facultad: "Ciencias de la Salud y Psicología", duracion: 5, titulo: "Licenciado/a en Psicología", rateDelta: 2.5, share: 0.16 },
];

export interface DemoPlan {
  id: number;
  codigo: string;
  nombre: string;
  vigenciaDesde: string;
  estado: "ACTIVO" | "PLANIFICADO";
  carreraId: number;
}

export const PLANS: readonly DemoPlan[] = [
  { id: 11, codigo: "ISI-2026", nombre: "Plan de Estudios 2026", vigenciaDesde: "2026-03-01", estado: "ACTIVO", carreraId: 1 },
  // Plan viejo de Sistemas: repite materias con otro id y el mismo código (la materia se agrupa por código).
  { id: 12, codigo: "ISI-2020", nombre: "Plan de Estudios 2020", vigenciaDesde: "2020-03-01", estado: "ACTIVO", carreraId: 1 },
  // Plan futuro: todavía sin asignaturas cargadas (el archivo de asignaturas no existe a propósito).
  { id: 13, codigo: "ISI-2027", nombre: "Plan de Estudios 2027", vigenciaDesde: "2027-03-01", estado: "PLANIFICADO", carreraId: 1 },
  { id: 21, codigo: "LAE-2026", nombre: "Plan de Estudios 2026", vigenciaDesde: "2026-03-01", estado: "ACTIVO", carreraId: 2 },
  { id: 31, codigo: "ABG-2026", nombre: "Plan de Estudios 2026", vigenciaDesde: "2026-03-01", estado: "ACTIVO", carreraId: 3 },
  { id: 41, codigo: "ARQ-2026", nombre: "Plan de Estudios 2026", vigenciaDesde: "2026-03-01", estado: "ACTIVO", carreraId: 4 },
  { id: 51, codigo: "PSI-2026", nombre: "Plan de Estudios 2026", vigenciaDesde: "2026-03-01", estado: "ACTIVO", carreraId: 5 },
];

export interface DemoSubject {
  // id de la asignatura en el plan vigente de su carrera.
  id: number;
  code: string;
  name: string;
  careerId: number;
  planId: number;
  anio: number;
  // Sedes donde se dicta, por letra (C Monserrat, B Belgrano, P Pilar, O Online).
  sedes: string;
  // Materia masiva: tiene dos comisiones en las sedes grandes.
  popular?: boolean;
  // Índice del primer período en que se dicta (0 = 2024-1C).
  since?: number;
  // Tasa base de aprobación (%) en 2024-1C y variación por período en puntos.
  base: number;
  trend: number;
  // Id de la misma materia en el plan viejo ISI-2020 (los cursos de Pilar y Online usan esta asignatura).
  legacyId?: number;
}

type SubjectSeed = Omit<DemoSubject, "id" | "planId" | "anio">;

const SUBJECT_SEEDS: SubjectSeed[] = [
  // Ingeniería y Tecnología
  { code: "MAT-101", name: "Análisis Matemático I", careerId: 1, sedes: "CBP", popular: true, base: 46, trend: 4, legacyId: 901 },
  { code: "MAT-102", name: "Álgebra y Geometría Analítica", careerId: 1, sedes: "CBP", popular: true, base: 55, trend: 1 },
  { code: "FIS-110", name: "Física I", careerId: 1, sedes: "CBP", base: 70, trend: -4, legacyId: 902 },
  { code: "INF-120", name: "Algoritmos y Estructuras de Datos", careerId: 1, sedes: "CBPO", popular: true, base: 67, trend: 0.5, legacyId: 903 },
  { code: "INF-210", name: "Bases de Datos", careerId: 1, sedes: "CB", base: 74, trend: 1, legacyId: 904 },
  { code: "INF-220", name: "Sistemas Operativos", careerId: 1, sedes: "CB", base: 66, trend: -1 },
  { code: "INF-230", name: "Inteligencia Artificial", careerId: 1, sedes: "CBO", since: 4, base: 79, trend: 1 },
  { code: "IND-201", name: "Probabilidad y Estadística", careerId: 1, sedes: "CBP", base: 54, trend: 2 },
  // Ciencias Económicas
  { code: "ECO-101", name: "Contabilidad Básica", careerId: 2, sedes: "CBPO", popular: true, base: 72, trend: -1 },
  { code: "ECO-110", name: "Microeconomía", careerId: 2, sedes: "CBP", base: 50, trend: 3 },
  { code: "ECO-120", name: "Macroeconomía", careerId: 2, sedes: "CBP", base: 57, trend: 0 },
  { code: "ECO-201", name: "Estadística para Negocios", careerId: 2, sedes: "CBO", base: 42, trend: 2.5 },
  { code: "ADM-101", name: "Administración General", careerId: 2, sedes: "CBPO", popular: true, base: 85, trend: -0.5 },
  { code: "ECO-210", name: "Costos y Gestión", careerId: 2, sedes: "CB", base: 82, trend: -3.5 },
  { code: "MKT-201", name: "Marketing Digital", careerId: 2, sedes: "CBO", since: 2, base: 86, trend: 0.5 },
  // Derecho y Ciencias Sociales
  { code: "DER-101", name: "Introducción al Derecho", careerId: 3, sedes: "CBPO", popular: true, base: 76, trend: 1 },
  { code: "DER-110", name: "Derecho Constitucional", careerId: 3, sedes: "CBP", base: 64, trend: 0 },
  { code: "DER-120", name: "Derecho Civil: Parte General", careerId: 3, sedes: "CBP", base: 44, trend: 2.5 },
  { code: "DER-210", name: "Derecho Penal", careerId: 3, sedes: "CB", base: 66, trend: -2 },
  { code: "DER-220", name: "Derecho Laboral", careerId: 3, sedes: "CBO", base: 71, trend: 1 },
  { code: "SOC-101", name: "Sociología", careerId: 3, sedes: "CBPO", base: 83, trend: 0 },
  // Arquitectura y Diseño
  { code: "ARQ-101", name: "Taller de Diseño I", careerId: 4, sedes: "CB", popular: true, base: 81, trend: 0 },
  { code: "ARQ-110", name: "Historia de la Arquitectura", careerId: 4, sedes: "CBP", base: 87, trend: -0.5 },
  { code: "ARQ-120", name: "Matemática Aplicada", careerId: 4, sedes: "CB", base: 41, trend: 3 },
  { code: "ARQ-210", name: "Estructuras I", careerId: 4, sedes: "CB", base: 58, trend: -1.5 },
  { code: "DIS-101", name: "Dibujo y Expresión Gráfica", careerId: 4, sedes: "CBP", base: 89, trend: 0 },
  // Ciencias de la Salud y Psicología
  { code: "PSI-101", name: "Psicología General", careerId: 5, sedes: "CBPO", popular: true, base: 74, trend: 1 },
  { code: "PSI-110", name: "Psicología Evolutiva", careerId: 5, sedes: "CBP", base: 69, trend: 0 },
  { code: "PSI-210", name: "Estadística Aplicada a la Psicología", careerId: 5, sedes: "CBP", base: 50, trend: 2 },
  { code: "HUM-101", name: "Comunicación y Lenguaje", careerId: 5, sedes: "CBPO", base: 86, trend: 0 },
  { code: "HUM-110", name: "Epistemología", careerId: 5, sedes: "CBO", base: 65, trend: -1.5 },
  { code: "SAL-101", name: "Anatomía Humana", careerId: 5, sedes: "CB", since: 3, base: 46, trend: 1 },
];

const PLAN_OF_CAREER = new Map(PLANS.filter((plan) => plan.id !== 12 && plan.id !== 13).map((plan) => [plan.carreraId, plan.id]));

// Ids de asignatura consecutivos desde 101; el año de la materia sale de su posición dentro de la carrera.
export const SUBJECTS: readonly DemoSubject[] = SUBJECT_SEEDS.map((seed, index) => {
  const sameCareer = SUBJECT_SEEDS.filter((candidate) => candidate.careerId === seed.careerId);
  return { ...seed, id: 101 + index, planId: PLAN_OF_CAREER.get(seed.careerId)!, anio: 1 + Math.floor(sameCareer.indexOf(seed) / 3) };
});

// Asignaturas del plan viejo ISI-2020 (mismo código y nombre que su par del plan 2026, otro id).
export const LEGACY_SUBJECTS: readonly (Omit<DemoSubject, "legacyId"> & { currentId: number })[] = SUBJECTS.filter((subject) => subject.legacyId !== undefined).map((subject) => ({
  ...subject,
  id: subject.legacyId!,
  planId: 12,
  currentId: subject.id,
}));

// Todas las asignaturas que existen en G9, con el plan al que pertenecen.
export function subjectsOfPlan(planId: number): { id: number; code: string; name: string; anio: number; planId: number }[] {
  const list = planId === 12 ? LEGACY_SUBJECTS : SUBJECTS.filter((subject) => subject.planId === planId);
  return list.map((subject) => ({ id: subject.id, code: subject.code, name: subject.name, anio: subject.anio, planId }));
}

export function subjectById(id: number): DemoSubject | undefined {
  return SUBJECTS.find((subject) => subject.id === id) ?? SUBJECTS.find((subject) => subject.legacyId === id);
}

export const careerById = (id: number): DemoCareer => CAREERS.find((career) => career.id === id)!;

// ---------------------------------------------------------------------------------------------
// Docentes (Backoffice: fichas de usuario) y usuarios de CORE
// ---------------------------------------------------------------------------------------------

export interface DemoTeacher {
  id: string;
  firstName: string;
  lastName: string;
  careerId: number;
  siteKey: SiteKey;
  // Sesgo propio en puntos sobre la tasa de la materia (entre -3 y 3).
  bias: number;
}

const TEACHER_NAMES: [careerId: number, names: string[]][] = [
  [1, ["Laura Gómez", "Martín Pérez", "Ricardo Fernández", "Silvana Acosta", "Gustavo Benítez", "Mariana Ledesma", "Federico Ibarra", "Carolina Duarte"]],
  [2, ["Alejandra Sosa", "Pablo Quiroga", "Verónica Molina", "Diego Herrera", "Natalia Cabrera", "Sergio Paz", "Lucía Ferreyra"]],
  [3, ["Marcelo Rojas", "Florencia Aguirre", "Hernán Domínguez", "Julieta Navarro", "Esteban Vega", "Paula Giménez"]],
  [4, ["Andrés Medina", "Cecilia Ortiz", "Rodrigo Suárez", "Valeria Campos", "Leandro Ruiz"]],
  [5, ["Gabriela Romero", "Nicolás Álvarez", "Mónica Peralta", "Santiago Ríos", "Daniela Castro", "Tomás Villalba"]],
];

const HOME_SITES: SiteKey[] = ["monserrat", "belgrano", "pilar", "monserrat"];

export const TEACHERS: readonly DemoTeacher[] = TEACHER_NAMES.flatMap(([careerId, names]) => names.map((name) => ({ careerId, name }))).map(
  ({ careerId, name }, index): DemoTeacher => {
    const [firstName, ...rest] = name.split(" ");
    return {
      id: demoUuid("teacher", index + 1),
      firstName,
      lastName: rest.join(" "),
      careerId,
      siteKey: HOME_SITES[index % HOME_SITES.length],
      bias: ((index * 37) % 13) / 2 - 3,
    };
  },
);

export interface DemoCoreUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  careerIds: string[];
  status: "ACTIVE" | "SUSPENDED";
}

// Contraseña de demo de todos los usuarios del login mock (no son credenciales reales de CORE).
export const DEMO_PASSWORD = "uadenet2026";

export const CORE_USERS: readonly DemoCoreUser[] = [
  {
    id: "5d1e7c2a-8f43-4b9e-a6d0-2c7f9e1b3a58", email: "direccion.academica@uade.edu.ar", firstName: "Dirección", lastName: "Académica",
    roles: ["ACADEMIC_ADMIN"], permissions: ["wallet:read:self", "wallet:credit:self", "academic:manage"], careerIds: [], status: "ACTIVE",
  },
  {
    id: "9c3e5b71-2d84-4a60-b1f7-0e6a4c8d2f15", email: "direccion.financiera@uade.edu.ar", firstName: "Dirección", lastName: "Financiera",
    roles: ["FINANCE_ADMIN"],
    permissions: ["wallet:read:self", "wallet:credit:self", "wallet:read:any", "wallet:read:aggregates", "wallet:credit:any", "wallet:admin", "backoffice:read", "backoffice:payroll:approve"],
    careerIds: [], status: "ACTIVE",
  },
  {
    id: "1a7d4f90-6b23-4c58-8e01-3f9b2a5c7d64", email: "direccion.general@uade.edu.ar", firstName: "Dirección", lastName: "General",
    roles: ["ADMIN"], permissions: ["wallet:read:self", "wallet:credit:self", "backoffice:manage", "backoffice:read"], careerIds: [], status: "ACTIVE",
  },
  {
    id: "ba310c57-a684-4dbf-a4a4-905fcfbefa08", email: "alumno.demo@uade.edu.ar", firstName: "Alumno", lastName: "Demo",
    roles: ["STUDENT"], permissions: ["wallet:read:self", "wallet:credit:self"], careerIds: ["1"], status: "ACTIVE",
  },
  {
    id: "e2b6a0d4-71c9-4f38-95a2-8d1c3b7e6f09", email: "suspendido.demo@uade.edu.ar", firstName: "Usuario", lastName: "Suspendido",
    roles: ["ACADEMIC_ADMIN"], permissions: ["wallet:read:self"], careerIds: [], status: "SUSPENDED",
  },
];

// ---------------------------------------------------------------------------------------------
// Tienda: productos
// ---------------------------------------------------------------------------------------------

export interface DemoProduct {
  id: string;
  name: string;
  category: string;
  // Precio en ARS a marzo de 2026 (después se ajusta por inflación mensual).
  price: number;
  // Peso en las compras: define el ranking por unidades.
  weight: number;
  // Desde esta fecha (AAAA-MM-DD) el producto cambia de nombre: el tablero toma el de la última compra.
  renamedFrom?: { date: string; name: string };
}

export const PRODUCTS: readonly DemoProduct[] = [
  { id: demoUuid("product", 1), name: "Cuaderno A4 rayado", category: "Papelería", price: 2500, weight: 10 },
  { id: demoUuid("product", 2), name: "Birome azul x3", category: "Papelería", price: 1800, weight: 9 },
  { id: demoUuid("product", 3), name: "Resaltadores x4", category: "Papelería", price: 3200, weight: 5 },
  { id: demoUuid("product", 4), name: "Mochila UADE", category: "Merchandising", price: 38000, weight: 2, renamedFrom: { date: "2026-09-01", name: "Mochila UADE 2026" } },
  { id: demoUuid("product", 5), name: "Buzo UADE", category: "Indumentaria", price: 42000, weight: 3 },
  { id: demoUuid("product", 6), name: "Remera UADE", category: "Indumentaria", price: 18000, weight: 6 },
  { id: demoUuid("product", 7), name: "Gorra UADE", category: "Indumentaria", price: 12500, weight: 3 },
  { id: demoUuid("product", 8), name: "Botella térmica", category: "Merchandising", price: 15500, weight: 4 },
  { id: demoUuid("product", 9), name: "Taza UADE", category: "Merchandising", price: 7500, weight: 4 },
  { id: demoUuid("product", 10), name: "Calculadora científica", category: "Tecnología", price: 28000, weight: 3 },
  { id: demoUuid("product", 11), name: "Pendrive 64GB", category: "Tecnología", price: 9500, weight: 4 },
  { id: demoUuid("product", 12), name: "Auriculares", category: "Tecnología", price: 21000, weight: 2 },
  { id: demoUuid("product", 13), name: "Manual de Álgebra y Geometría", category: "Librería", price: 16000, weight: 4 },
  { id: demoUuid("product", 14), name: "Código Civil comentado", category: "Librería", price: 24500, weight: 2 },
];

// ---------------------------------------------------------------------------------------------
// Eventos de G6: categorías
// ---------------------------------------------------------------------------------------------

export const EVENT_CATEGORIES = ["Charla", "Taller", "Congreso", "Jornada", "Networking", "Seminario"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// ---------------------------------------------------------------------------------------------
// Fechas de referencia del demo
// ---------------------------------------------------------------------------------------------

// "Ahora" del demo: 2026-11-04 23:00 en Argentina (UTC-3). Ningún evento ocurre después; lo que sí puede estar en el
// futuro son datos de negocio (el fin de un evento todavía no realizado, la fecha de fin del cuatrimestre).
export const DEMO_NOW = Date.UTC(2026, 10, 5, 2, 0);
// Primer mes con datos de finanzas y eventos (DASHBOARD_FIRST_MONTH).
export const FIRST_DEMO_MONTH = "2026-03";

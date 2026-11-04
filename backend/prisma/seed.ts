// Seed de desarrollo: eventos representativos de cada tipo del contrato. Re-ejecutable (upsert por eventId).
import { PrismaClient, Prisma } from "@prisma/client";
import { EVENT_SCHEMAS } from "../src/domain/entities/event-schemas";
import { SourceModule } from "../src/domain/entities/event-source.entity";
import { validateEventPayload } from "../src/domain/services/event-payload-validator.service";

try {
  process.loadEnvFile();
} catch {
  // Sin .env se usa DATABASE_URL del entorno.
}

type SeedEvent = {
  eventId: string;
  sourceModule: SourceModule;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

const CENTRO = "sede-centro";
const BELGRANO = "sede-belgrano";
const PILAR = "sede-pilar";
const ONLINE = "campus-online";

const ev = (
  eventId: string,
  sourceModule: SourceModule,
  eventType: string,
  occurredAt: string,
  payload: Record<string, unknown>,
): SeedEvent => ({ eventId: `seed-${eventId}`, sourceModule, eventType, occurredAt, payload });

const EVENTS: SeedEvent[] = [
  // --- Gestión Académica ---
  ev("ga-res-1", "gestion-academica", "resultado.publicado", "2026-07-10T12:00:00-03:00", {
    alumnoId: "al-001", cursoId: "cur-101", materia: "MAT101", comision: "A", docenteId: "doc-01", sedeId: CENTRO,
    cuatrimestre: "2026-1C", notaFinal: 8, estado: "APROBADO", aprobado: true, fechaResultado: "2026-07-10",
  }),
  ev("ga-res-2", "gestion-academica", "resultado.publicado", "2026-07-10T12:05:00-03:00", {
    alumnoId: "al-002", cursoId: "cur-101", materia: "MAT101", docenteId: "doc-01", sedeId: BELGRANO,
    cuatrimestre: "2026-1C", notaFinal: 3, estado: "DESAPROBADO", aprobado: false,
  }),
  ev("ga-res-3", "gestion-academica", "resultado.publicado", "2026-07-11T12:00:00-03:00", {
    alumnoId: "al-003", cursoId: "cur-202", materia: "FIS201", docenteId: "doc-02", sedeId: PILAR,
    cuatrimestre: "2026-1C", aprobado: true,
  }),
  ev("ga-res-4", "gestion-academica", "resultado.publicado", "2025-12-12T12:00:00-03:00", {
    alumnoId: "al-011", cursoId: "cur-091", materia: "MAT101", docenteId: "doc-01", sedeId: CENTRO,
    cuatrimestre: "2025-2C", aprobado: true,
  }),
  ev("ga-res-5", "gestion-academica", "resultado.publicado", "2025-12-12T12:05:00-03:00", {
    alumnoId: "al-012", cursoId: "cur-091", materia: "MAT101", docenteId: "doc-01", sedeId: CENTRO,
    cuatrimestre: "2025-2C", aprobado: false,
  }),
  ev("ga-resmod-1", "gestion-academica", "resultado.modificado", "2026-07-15T10:00:00-03:00", {
    alumnoId: "al-002", cursoId: "cur-101", notaFinal: 4, estado: "APROBADO", aprobado: true, motivo: "Revisión de examen",
  }),
  ev("ga-curso-1", "gestion-academica", "curso.abierto", "2026-03-01T09:00:00-03:00", {
    cursoId: "cur-101", materia: "MAT101", nombreMateria: "Matemática I", facultad: "Ingeniería", comision: "A",
    sedeId: CENTRO, cuatrimestre: "2026-1C", cupo: 40,
  }),
  ev("ga-curso-2", "gestion-academica", "curso.abierto", "2026-03-01T09:10:00-03:00", {
    cursoId: "cur-202", materia: "FIS201", sedeId: PILAR, cuatrimestre: "2026-1C",
  }),
  ev("ga-cursocerr-1", "gestion-academica", "curso.cerrado", "2026-07-20T18:00:00-03:00", {
    cursoId: "cur-101", sedeId: CENTRO, cuatrimestre: "2026-1C",
  }),
  ev("ga-cuatri-1", "gestion-academica", "cuatrimestre.definido", "2026-02-15T09:00:00-03:00", {
    cuatrimestre: "2026-1C", inicio: "2026-03-09", fin: "2026-07-31",
  }),

  // --- Portal Docente ---
  ev("pd-curso-1", "portal-docente", "curso.creado", "2026-02-20T11:00:00-03:00", {
    cursoId: "cur-101", docenteId: "doc-01", materia: "MAT101", comision: "A", sedeId: CENTRO, cuatrimestre: "2026-1C",
  }),
  ev("pd-acta-1", "portal-docente", "acta.cerrada", "2026-07-10T11:30:00-03:00", {
    cursoId: "cur-101", alumnoId: "al-001", nota: 8, aprobado: true,
  }),
  ev("pd-acta-2", "portal-docente", "acta.cerrada", "2026-07-10T11:31:00-03:00", {
    cursoId: "cur-101", alumnoId: "al-002", aprobado: false,
  }),

  // --- Portal Estudiante ---
  ev("pe-insc-1", "portal-estudiante", "inscripcion.confirmada", "2026-03-02T10:00:00-03:00", {
    alumnoId: "al-001", cursoId: "cur-101", materia: "MAT101", sedeId: CENTRO, cuatrimestre: "2026-1C",
  }),
  ev("pe-insc-2", "portal-estudiante", "inscripcion.confirmada", "2026-03-02T10:05:00-03:00", {
    alumnoId: "al-002", cursoId: "cur-101", materia: "MAT101", sedeId: BELGRANO, cuatrimestre: "2026-1C",
  }),
  ev("pe-cancel-1", "portal-estudiante", "inscripcion.cancelada", "2026-03-20T15:00:00-03:00", {
    alumnoId: "al-004", cursoId: "cur-202", sedeId: ONLINE, cuatrimestre: "2026-1C", motivo: "Superposición horaria",
  }),

  // --- Biblioteca ---
  ev("bi-prest-1", "biblioteca", "prestamo.realizado", "2026-05-04T14:00:00-03:00", {
    prestamoId: "pr-001", alumnoId: "al-001", materialId: "978-950-00-0001-1", sedeId: CENTRO, fechaVencimiento: "2026-05-18",
  }),
  ev("bi-prest-2", "biblioteca", "prestamo.realizado", "2026-05-05T14:00:00-03:00", {
    prestamoId: "pr-002", alumnoId: "al-003", materialId: "978-950-00-0002-8", sedeId: PILAR,
  }),
  ev("bi-dev-1", "biblioteca", "prestamo.devuelto", "2026-05-17T16:00:00-03:00", {
    prestamoId: "pr-001", sedeId: CENTRO, conDemora: false,
  }),
  ev("bi-dev-2", "biblioteca", "prestamo.devuelto", "2026-05-25T16:00:00-03:00", {
    prestamoId: "pr-002", sedeId: PILAR, conDemora: true,
  }),

  // --- Eventos Académicos ---
  ev("evt-real-1", "eventos", "evento.realizado", "2026-08-12T18:00:00-03:00", {
    eventoId: "ev-001", tipoEvento: "charla", locacion: "Auditorio", cupo: 120, sedeId: CENTRO, fecha: "2026-08-12", costo: 0,
  }),
  ev("evt-real-2", "eventos", "evento.realizado", "2026-08-19T17:00:00-03:00", {
    eventoId: "ev-002", tipoEvento: "taller", cupo: 30, sedeId: BELGRANO, fecha: "2026-08-19", costo: 5000,
  }),
  ev("evt-insc-1", "eventos", "inscripcion.confirmada", "2026-08-01T10:00:00-03:00", {
    eventoId: "ev-002", personaId: "per-001", monto: 5000,
  }),
  ev("evt-insc-2", "eventos", "inscripcion.confirmada", "2026-08-01T10:10:00-03:00", {
    eventoId: "ev-001", personaId: "per-002", monto: 0,
  }),
  ev("evt-asis-1", "eventos", "asistencia.registrada", "2026-08-12T18:30:00-03:00", {
    eventoId: "ev-001", personaId: "per-002", presente: true,
  }),
  ev("evt-asis-2", "eventos", "asistencia.registrada", "2026-08-19T17:30:00-03:00", {
    eventoId: "ev-002", personaId: "per-001", presente: false,
  }),
  ev("evt-cancel-1", "eventos", "evento.cancelado", "2026-07-02T09:00:00-03:00", {
    eventoId: "ev-003", sedeId: PILAR, motivo: "Falta de inscriptos",
  }),
  ev("evt-insccancel-1", "eventos", "inscripcion.cancelada", "2026-08-05T12:00:00-03:00", {
    eventoId: "ev-002", personaId: "per-003", montoDevuelto: 5000,
  }),

  // --- Tienda ---
  ev("ti-compra-1", "tienda", "compra.realizada", "2026-08-10T13:00:00-03:00", {
    compraId: "co-001", sedeId: CENTRO, fecha: "2026-08-10", total: 27003500,
    items: [
      { producto: "Buzo UADE", categoria: "indumentaria", unidades: 600, monto: 27000000 },
      { producto: "Lapicera", unidades: 5, monto: 3500 },
    ],
  }),
  ev("ti-compra-2", "tienda", "compra.realizada", "2026-08-08T13:00:00-03:00", {
    compraId: "co-002", sedeId: BELGRANO, fecha: "2026-08-08", total: 6200000,
    items: [{ producto: "Cuaderno", categoria: "papelería", unidades: 1100, monto: 6200000 }],
  }),
  ev("ti-dev-1", "tienda", "compra.devuelta", "2026-08-12T13:00:00-03:00", {
    compraId: "co-001", sedeId: CENTRO, fecha: "2026-08-12",
    items: [{ producto: "Buzo UADE", categoria: "indumentaria", unidades: 10, monto: 450000 }],
  }),

  // --- Comedor ---
  ev("cm-res-1", "comedor", "reserva.confirmada", "2026-08-03T09:00:00-03:00", {
    reservaId: "rs-001", monto: 4500, sedeId: CENTRO, turno: "12:30", fecha: "2026-08-04",
  }),
  ev("cm-res-2", "comedor", "reserva.confirmada", "2026-08-03T09:05:00-03:00", {
    reservaId: "rs-002", monto: 4500, sedeId: PILAR, fecha: "2026-08-04",
  }),
  ev("cm-res-3", "comedor", "reserva.confirmada", "2026-07-03T09:00:00-03:00", {
    reservaId: "rs-003", monto: 4000, sedeId: CENTRO, fecha: "2026-07-04",
  }),
  ev("cm-asis-1", "comedor", "reserva.asistida", "2026-08-04T12:45:00-03:00", {
    reservaId: "rs-001", montoRestituido: 1500, sedeId: CENTRO,
  }),
  ev("cm-cancel-1", "comedor", "reserva.cancelada", "2026-08-03T20:00:00-03:00", {
    reservaId: "rs-002", montoDevuelto: 4500, sedeId: PILAR,
  }),

  // --- Backoffice ---
  ev("bo-sueldos-1", "backoffice", "sueldos.liquidados", "2026-08-31T18:00:00-03:00", {
    periodo: "2026-08", sedeId: CENTRO, monto: 25000000, desglose: { docentes: 18000000, administrativos: 7000000 },
  }),
  ev("bo-sueldos-2", "backoffice", "sueldos.liquidados", "2026-08-31T18:05:00-03:00", {
    periodo: "2026-08", sedeId: BELGRANO, monto: 12000000,
  }),
  ev("bo-gasto-1", "backoffice", "gasto.registrado", "2026-08-05T10:00:00-03:00", {
    categoria: "mantenimiento", monto: 850000, sedeId: PILAR, fecha: "2026-08-05",
  }),
  ev("bo-docente-1", "backoffice", "docente.alta", "2026-02-01T09:00:00-03:00", {
    docenteId: "doc-01", nombre: "Laura Gómez", facultad: "Ingeniería",
  }),
  ev("bo-docente-2", "backoffice", "docente.alta", "2026-02-01T09:05:00-03:00", {
    docenteId: "doc-02", nombre: "Martín Pérez",
  }),
  ev("bo-sede-1", "backoffice", "sede.definida", "2026-01-10T09:00:00-03:00", { sedeId: CENTRO, nombre: "Sede Centro" }),
  ev("bo-sede-2", "backoffice", "sede.definida", "2026-01-10T09:01:00-03:00", { sedeId: BELGRANO, nombre: "Sede Belgrano" }),
  ev("bo-sede-3", "backoffice", "sede.definida", "2026-01-10T09:02:00-03:00", { sedeId: PILAR, nombre: "Sede Pilar" }),
  ev("bo-sede-4", "backoffice", "sede.definida", "2026-01-10T09:03:00-03:00", { sedeId: ONLINE, nombre: "Campus Online" }),

  // --- CORE ---
  ev("core-mov-1", "core", "saldo.movimiento", "2026-08-03T09:00:00-03:00", {
    cuentaId: "cta-001", tipo: "carga", monto: 1500000000, origen: "tienda", sedeId: CENTRO, fecha: "2026-08-03", saldoPosterior: 1500000000,
  }),
  ev("core-mov-2", "core", "saldo.movimiento", "2026-08-04T12:50:00-03:00", {
    cuentaId: "cta-001", tipo: "cobro", monto: 900000000, origen: "comedor", sedeId: CENTRO, fecha: "2026-08-04",
  }),
  ev("core-mov-3", "core", "saldo.movimiento", "2026-08-04T13:00:00-03:00", {
    cuentaId: "cta-001", tipo: "restitucion", monto: 100000000, origen: "comedor", sedeId: CENTRO, fecha: "2026-08-04",
  }),
  ev("core-mov-4", "core", "saldo.movimiento", "2026-07-03T09:00:00-03:00", {
    cuentaId: "cta-001", tipo: "carga", monto: 1200000000, origen: "tienda", sedeId: CENTRO, fecha: "2026-07-03",
  }),
  ev("core-mov-5", "core", "saldo.movimiento", "2026-07-04T12:50:00-03:00", {
    cuentaId: "cta-001", tipo: "cobro", monto: 800000000, origen: "comedor", sedeId: CENTRO, fecha: "2026-07-04",
  }),
];

// Sanidad: cada payload cumple el esquema y no queda ningún tipo del contrato sin cubrir.
function assertSeedIsValid(): void {
  for (const event of EVENTS) {
    const problems = validateEventPayload(event.sourceModule, event.eventType, event.payload);
    if (!problems || problems.missing.length || problems.invalid.length) {
      throw new Error(`Seed inválido (${event.eventId}): ${JSON.stringify(problems)}`);
    }
  }
  for (const schema of EVENT_SCHEMAS) {
    const covered = EVENTS.some((e) => e.sourceModule === schema.sourceModule && e.eventType === schema.eventType);
    if (!covered) throw new Error(`Falta seed para ${schema.sourceModule} / ${schema.eventType}`);
  }
}

async function main(): Promise<void> {
  assertSeedIsValid();
  const prisma = new PrismaClient();
  try {
    for (const event of EVENTS) {
      const data = {
        sourceModule: event.sourceModule,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        payload: event.payload as Prisma.InputJsonObject,
      };
      await prisma.inboxEvent.upsert({ where: { eventId: event.eventId }, update: data, create: { eventId: event.eventId, ...data } });
    }
    console.log(`Seed listo: ${EVENTS.length} eventos.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

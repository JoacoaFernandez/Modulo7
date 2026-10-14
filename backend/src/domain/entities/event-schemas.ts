// Catálogo de payloads por (sourceModule, eventType). Es la fuente de verdad del contrato:
// el validador de ingesta lo aplica y la tabla de tipos de EVENTOS.md se genera de acá
// (npm run docs:payloads).
import { EventSchema, FieldSpec } from "./event-schema.entity";
import { SourceModule } from "./event-source.entity";

const str = (name: string, description: string, required = true): FieldSpec => ({
  name,
  type: "string",
  required,
  description,
});
const num = (name: string, description: string, required = true): FieldSpec => ({
  name,
  type: "number",
  required,
  description,
});
const bool = (name: string, description: string, required = true): FieldSpec => ({
  name,
  type: "boolean",
  required,
  description,
});
const date = (name: string, description: string, required = true): FieldSpec => ({
  name,
  type: "date",
  required,
  description,
});

const sedeId = str("sedeId", "Id de la sede en el catálogo de Backoffice.");
const alumnoId = str("alumnoId", "Id del alumno.");
const cursoId = str("cursoId", "Id del curso (string).");
const docenteId = str("docenteId", "Id del docente (el mismo de `docente.alta`).");
const cuatrimestre = str("cuatrimestre", "Formato AAAA-NC, por ejemplo `2026-2C`.");

const purchaseItems: FieldSpec = {
  name: "items",
  type: "array",
  required: true,
  description: "Ítems de la compra.",
  fields: [
    str("producto", "Nombre del producto."),
    str("categoria", "Categoría del producto.", false),
    num("unidades", "Unidades."),
    num("monto", "Monto en ARS."),
  ],
};

export const EVENT_SCHEMAS: readonly EventSchema[] = [
  // --- Gestión Académica (9) ---
  {
    sourceModule: "gestion-academica",
    eventType: "resultado.publicado",
    fields: [
      alumnoId,
      cursoId,
      str("materia", "Código de la materia."),
      str("comision", "Comisión.", false),
      docenteId,
      sedeId,
      cuatrimestre,
      num("notaFinal", "Nota final.", false),
      str("estado", "Situación de la materia (`APROBADO`, `DESAPROBADO`, ...).", false),
      bool("aprobado", "Si aprobó la cursada."),
      date("fechaResultado", "Fecha del resultado, hora de Argentina.", false),
    ],
  },
  {
    sourceModule: "gestion-academica",
    eventType: "resultado.modificado",
    fields: [
      alumnoId,
      cursoId,
      num("notaFinal", "Nota corregida.", false),
      str("estado", "Situación corregida.", false),
      bool("aprobado", "Si aprobó, con la corrección."),
      str("motivo", "Motivo de la corrección.", false),
    ],
  },
  {
    sourceModule: "gestion-academica",
    eventType: "curso.abierto",
    fields: [
      cursoId,
      str("materia", "Código de la materia."),
      str("nombreMateria", "Nombre de la materia.", false),
      str("facultad", "Facultad.", false),
      str("comision", "Comisión.", false),
      sedeId,
      cuatrimestre,
      num("cupo", "Cupo máximo.", false),
    ],
  },
  { sourceModule: "gestion-academica", eventType: "curso.cerrado", fields: [cursoId, sedeId, cuatrimestre] },
  {
    sourceModule: "gestion-academica",
    eventType: "cuatrimestre.definido",
    fields: [cuatrimestre, date("inicio", "Primer día del cuatrimestre."), date("fin", "Último día del cuatrimestre.")],
  },

  // --- Portal Docente (2) ---
  {
    sourceModule: "portal-docente",
    eventType: "curso.creado",
    fields: [cursoId, docenteId, str("materia", "Código de la materia."), str("comision", "Comisión.", false), sedeId, cuatrimestre],
  },
  {
    sourceModule: "portal-docente",
    eventType: "acta.cerrada",
    fields: [cursoId, alumnoId, num("nota", "Nota.", false), bool("aprobado", "Si aprobó.")],
  },

  // --- Portal Estudiante (1) ---
  {
    sourceModule: "portal-estudiante",
    eventType: "inscripcion.confirmada",
    fields: [alumnoId, cursoId, str("materia", "Código de la materia."), sedeId, cuatrimestre],
  },
  {
    sourceModule: "portal-estudiante",
    eventType: "inscripcion.cancelada",
    fields: [alumnoId, cursoId, sedeId, cuatrimestre, str("motivo", "Motivo de la baja.", false)],
  },

  // --- Biblioteca (3) ---
  {
    sourceModule: "biblioteca",
    eventType: "prestamo.realizado",
    fields: [
      str("prestamoId", "Id del préstamo."),
      alumnoId,
      str("materialId", "Id del material (ISBN)."),
      sedeId,
      date("fechaVencimiento", "Fecha límite de devolución.", false),
    ],
  },
  {
    sourceModule: "biblioteca",
    eventType: "prestamo.devuelto",
    fields: [str("prestamoId", "Id del préstamo."), sedeId, bool("conDemora", "Si se devolvió después del vencimiento.", false)],
  },

  // --- Eventos Académicos (6) ---
  {
    sourceModule: "eventos",
    eventType: "evento.realizado",
    fields: [
      str("eventoId", "Id del evento."),
      str("tipoEvento", "Tipo (charla, taller, ...)."),
      str("locacion", "Locación.", false),
      num("cupo", "Cupo máximo."),
      sedeId,
      date("fecha", "Fecha del evento."),
      num("costo", "Costo de inscripción en ARS (0 si es gratis).", false),
    ],
  },
  {
    sourceModule: "eventos",
    eventType: "inscripcion.confirmada",
    fields: [str("eventoId", "Id del evento."), str("personaId", "Id de la persona."), num("monto", "Monto pagado en ARS (0 si es gratis).")],
  },
  {
    sourceModule: "eventos",
    eventType: "asistencia.registrada",
    fields: [str("eventoId", "Id del evento."), str("personaId", "Id de la persona."), bool("presente", "Si asistió.")],
  },
  {
    sourceModule: "eventos",
    eventType: "evento.cancelado",
    fields: [str("eventoId", "Id del evento."), sedeId, str("motivo", "Motivo.", false)],
  },
  {
    sourceModule: "eventos",
    eventType: "inscripcion.cancelada",
    fields: [str("eventoId", "Id del evento."), str("personaId", "Id de la persona."), num("montoDevuelto", "Monto devuelto en ARS.", false)],
  },

  // --- Tienda (5) ---
  {
    sourceModule: "tienda",
    eventType: "compra.realizada",
    fields: [str("compraId", "Id de la compra."), sedeId, date("fecha", "Fecha de la compra."), num("total", "Total en ARS."), purchaseItems],
  },
  {
    sourceModule: "tienda",
    eventType: "compra.devuelta",
    fields: [str("compraId", "Id de la compra original."), sedeId, date("fecha", "Fecha de la devolución."), purchaseItems],
  },

  // --- Comedor (4) ---
  {
    sourceModule: "comedor",
    eventType: "reserva.confirmada",
    fields: [str("reservaId", "Id de la reserva."), num("monto", "Costo cobrado en ARS."), sedeId, str("turno", "Horario del turno.", false), date("fecha", "Fecha del turno.")],
  },
  {
    sourceModule: "comedor",
    eventType: "reserva.asistida",
    fields: [str("reservaId", "Id de la reserva."), num("montoRestituido", "Monto restituido en ARS."), sedeId],
  },
  {
    sourceModule: "comedor",
    eventType: "reserva.cancelada",
    fields: [str("reservaId", "Id de la reserva."), num("montoDevuelto", "Monto devuelto en ARS."), sedeId],
  },

  // --- Backoffice (8) ---
  {
    sourceModule: "backoffice",
    eventType: "sueldos.liquidados",
    fields: [
      str("periodo", "Mes liquidado, formato AAAA-MM."),
      sedeId,
      num("monto", "Total liquidado en ARS."),
      {
        name: "desglose",
        type: "object",
        required: false,
        description: "Desglose del total.",
        fields: [num("docentes", "Sueldos docentes en ARS.", false), num("administrativos", "Sueldos administrativos en ARS.", false)],
      },
    ],
  },
  {
    sourceModule: "backoffice",
    eventType: "gasto.registrado",
    fields: [str("categoria", "Categoría del gasto."), num("monto", "Monto en ARS."), sedeId, date("fecha", "Fecha del gasto.")],
  },
  {
    sourceModule: "backoffice",
    eventType: "docente.alta",
    fields: [docenteId, str("nombre", "Nombre completo."), str("facultad", "Facultad.", false)],
  },
  {
    sourceModule: "backoffice",
    eventType: "sede.definida",
    fields: [sedeId, str("nombre", "Nombre de la sede.")],
  },

  // --- CORE (10) ---
  {
    sourceModule: "core",
    eventType: "saldo.movimiento",
    fields: [
      str("cuentaId", "Id de la cuenta institucional."),
      { name: "tipo", type: "string", required: true, description: "Tipo de movimiento.", oneOf: ["carga", "cobro", "acreditacion", "multa", "restitucion"] },
      num("monto", "Monto en ARS."),
      { name: "origen", type: "string", required: true, description: "Módulo que originó el movimiento.", oneOf: ["comedor", "tienda", "evento", "biblioteca"] },
      sedeId,
      date("fecha", "Fecha del movimiento."),
      num("saldoPosterior", "Saldo de la cuenta después del movimiento.", false),
    ],
  },
];

export function findEventSchema(sourceModule: SourceModule, eventType: string): EventSchema | undefined {
  return EVENT_SCHEMAS.find((schema) => schema.sourceModule === sourceModule && schema.eventType === eventType);
}

export function eventTypesOf(sourceModule: SourceModule): string[] {
  return EVENT_SCHEMAS.filter((schema) => schema.sourceModule === sourceModule).map((schema) => schema.eventType);
}

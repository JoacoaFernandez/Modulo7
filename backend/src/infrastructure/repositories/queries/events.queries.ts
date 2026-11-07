// Query del tablero de eventos académicos sobre inbox_events (events.* y backoffice.location.upserted.v1).
import { Prisma, PrismaClient } from "@prisma/client";
import { ARGENTINA_TZ } from "../../../domain/services/period-catalog.service";

// Un evento realizado con sus inscriptos y presentes (personas distintas).
export interface HeldEventRow {
  ym: string;
  // `category` del evento o, si G6 no la informa, la clase de precio derivada de `price`: Pago / Gratuito.
  eventType: string;
  // true si el tipo es la aproximación por precio (no vino `category`).
  typeFromPrice: boolean;
  capacity: number;
  registered: number;
  present: number;
}

// Eventos realizados en [from, min(to, ahora)): último evento por eventId con `endAt` en el rango (mes en hora de
// Argentina); la sede sale de locationId → siteId (último location.upserted). Sin location.upserted el evento no
// tiene sede y sólo cuenta en "Todas las sedes". Inscriptos = registrationId distintos; presentes = userId distintos con present.
export async function queryHeldEvents(prisma: PrismaClient, from: string, to: string, siteId: string | null): Promise<HeldEventRow[]> {
  const rows = await prisma.$queryRaw<
    { ym: string; event_type: string; type_from_price: boolean; capacity: number; registered: number; present: number }[]
  >`
    WITH loc AS (
      SELECT DISTINCT ON (data->>'locationId') data->>'locationId' AS location_id, data->>'siteId' AS site_id
      FROM inbox_events WHERE event_type = 'backoffice.location.upserted.v1'
      ORDER BY data->>'locationId', occurred_at DESC
    ), held AS (
      SELECT DISTINCT ON (e.data->>'eventId')
        e.data->>'eventId' AS event_id, (e.data->>'endAt')::timestamptz AS end_at,
        COALESCE((e.data->>'capacity')::int, 0) AS capacity,
        NULLIF(e.data->>'category', '') AS category,
        CASE WHEN COALESCE((e.data->>'price')::numeric, 0) > 0 THEN 'Pago' ELSE 'Gratuito' END AS price_class,
        l.site_id
      FROM inbox_events e LEFT JOIN loc l ON l.location_id = e.data->>'locationId'
      WHERE e.event_type = 'events.event.created.v1'
      ORDER BY e.data->>'eventId', e.occurred_at DESC
    )
    SELECT to_char(h.end_at AT TIME ZONE ${ARGENTINA_TZ}, 'YYYY-MM') AS ym,
      COALESCE(h.category, h.price_class) AS event_type, (h.category IS NULL) AS type_from_price,
      h.capacity,
      (SELECT COUNT(DISTINCT r.data->>'registrationId')::int FROM inbox_events r
        WHERE r.event_type = 'events.registration.completed.v1' AND r.data->>'eventId' = h.event_id) AS registered,
      (SELECT COUNT(DISTINCT a.data->>'userId')::int FROM inbox_events a
        WHERE a.event_type = 'events.attendance.recorded.v1' AND a.data->>'eventId' = h.event_id
          AND (a.data->>'present')::boolean) AS present
    FROM held h
    WHERE h.end_at >= ${from}::timestamptz AND h.end_at < LEAST(${to}::timestamptz, now())
      ${siteId === null ? Prisma.empty : Prisma.sql`AND h.site_id = ${siteId}`}`;

  return rows.map((row) => ({
    ym: row.ym,
    eventType: row.event_type,
    typeFromPrice: row.type_from_price,
    capacity: row.capacity,
    registered: row.registered,
    present: row.present,
  }));
}

// Queries del tablero financiero sobre inbox_events (tienda y comedor) y wallet_balance_snapshots. Montos en ARS.
// Ingresos, egresos y sueldos no salen de acá: vienen de `aggregates` de CORE (docs/INTEGRACION.md, 6.2).
import { Prisma, PrismaClient } from "@prisma/client";
import { argentinaMonth, MonthRange, siteFilter } from "./query-helpers";

export interface ProductRow {
  productId: string;
  productName: string;
  category: string | null;
  units: number;
  revenue: number;
}

export interface DiningRow {
  siteId: string;
  ym: string;
  revenue: number;
  tickets: number;
}

// Productos del mes: ítems de store.purchase.completed.v1 agrupados por productId (nombre y categoría de la última
// compra). Con sede elegida sólo cuentan las compras que traen ese siteId (es opcional en el evento).
export async function queryTopProducts(prisma: PrismaClient, month: MonthRange, siteId: string | null): Promise<ProductRow[]> {
  const rows = await prisma.$queryRaw<{ product_id: string; product_name: string; category: string | null; units: number; revenue: number }[]>`
    WITH lines AS (
      SELECT e.occurred_at, item->>'productId' AS product_id, item->>'productName' AS product_name,
        NULLIF(item->>'category', '') AS category,
        (item->>'quantity')::numeric AS quantity, (item->>'subtotal')::numeric AS subtotal
      FROM inbox_events e, jsonb_array_elements(e.data->'items') AS item
      WHERE e.event_type = 'store.purchase.completed.v1'
        AND e.occurred_at >= ${month.start}::timestamptz AND e.occurred_at < ${month.end}::timestamptz
        ${siteFilter(siteId, Prisma.sql`e.data->>'siteId'`)}
    )
    SELECT product_id,
      (array_agg(product_name ORDER BY occurred_at DESC))[1] AS product_name,
      (array_agg(category ORDER BY occurred_at DESC) FILTER (WHERE category IS NOT NULL))[1] AS category,
      SUM(quantity)::float8 AS units, SUM(subtotal)::float8 AS revenue
    FROM lines
    GROUP BY product_id`;

  return rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    category: row.category,
    units: row.units,
    revenue: row.revenue,
  }));
}

// Facturación y tickets de comedor por sede y mes: reservas creadas en el rango sin su cancelación (cruce por
// reservationId, sin límite de fecha) y, con `netOfAttendance`, también sin la asistencia (lo restituido).
// Sin filtro de sede: el tablero muestra todas las sedes y el filtro sólo resalta.
export async function queryDiningRevenue(prisma: PrismaClient, from: string, to: string, netOfAttendance: boolean): Promise<DiningRow[]> {
  const rows = await prisma.$queryRaw<{ site_id: string; ym: string; revenue: number; tickets: number }[]>`
    WITH res AS (
      SELECT DISTINCT ON (data->>'reservationId')
        data->>'reservationId' AS reservation_id, data->>'siteId' AS site_id,
        (data->>'amount')::numeric AS amount, occurred_at
      FROM inbox_events
      WHERE event_type = 'dining.reservation.created.v1'
        AND occurred_at >= ${from}::timestamptz AND occurred_at < ${to}::timestamptz
      ORDER BY data->>'reservationId', occurred_at
    )
    SELECT r.site_id, ${argentinaMonth(Prisma.sql`r.occurred_at`)} AS ym,
           COALESCE(SUM(r.amount), 0)::float8 AS revenue, COUNT(*)::int AS tickets
    FROM res r
    WHERE NOT EXISTS (SELECT 1 FROM inbox_events c
                      WHERE c.event_type = 'dining.reservation.cancelled.v1'
                        AND c.data->>'reservationId' = r.reservation_id)
      ${
        netOfAttendance
          ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM inbox_events a
                         WHERE a.event_type = 'dining.attendance.recorded.v1'
                           AND a.data->>'reservationId' = r.reservation_id)`
          : Prisma.empty
      }
    GROUP BY r.site_id, ym`;

  return rows.map((row) => ({ siteId: row.site_id, ym: row.ym, revenue: row.revenue, tickets: row.tickets }));
}

// Sedes con alguna reserva de comedor en cualquier fecha: las que tienen servicio.
export async function queryDiningSites(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ site_id: string }[]>`
    SELECT DISTINCT data->>'siteId' AS site_id
    FROM inbox_events
    WHERE event_type = 'dining.reservation.created.v1' AND data->>'siteId' IS NOT NULL`;

  return rows.map((row) => row.site_id);
}

// Saldo vigente por mes (AAAA-MM) de los snapshots que toma el job sobre `aggregates`.
export async function queryBalanceSnapshots(prisma: PrismaClient, months: string[]): Promise<Map<string, number>> {
  const rows = await prisma.walletBalanceSnapshot.findMany({ where: { month: { in: months } } });
  return new Map(rows.map((row) => [row.month, Number(row.outstandingBalance.toString())]));
}

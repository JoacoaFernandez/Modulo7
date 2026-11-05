// Queries del tablero financiero sobre inbox_events (core, backoffice, tienda y comedor). Montos en ARS.
import { PrismaClient } from "@prisma/client";
import { argentinaMonth, MonthRange, siteFilter } from "./query-helpers";

export interface MonthlyFlowRow {
  ym: string;
  income: number;
  expense: number;
}

export interface ExpenseRow {
  // "sueldos-docentes", "sueldos-administrativos", "sueldos-sin-desglose" o la categoría libre del gasto.
  category: string;
  total: number;
}

export interface ProductRow {
  producto: string;
  categoria: string | null;
  unidades: number;
  monto: number;
}

export interface DiningRow {
  sedeId: string;
  ym: string;
  revenue: number;
  tickets: number;
}

// Ingresos y egresos por mes de saldo.movimiento. Criterio del plan: `carga` es ingreso y el
// resto de los tipos (cobro, acreditacion, multa, restitucion) egreso.
export async function queryMonthlyFlows(
  prisma: PrismaClient,
  from: string,
  to: string,
  sedeId: string | null,
): Promise<MonthlyFlowRow[]> {
  return prisma.$queryRaw<MonthlyFlowRow[]>`
    SELECT ${argentinaMonth()} AS ym,
      COALESCE(SUM(CASE WHEN data->>'tipo' = 'carga' THEN (data->>'monto')::numeric ELSE 0 END), 0)::float8 AS income,
      COALESCE(SUM(CASE WHEN data->>'tipo' <> 'carga' THEN (data->>'monto')::numeric ELSE 0 END), 0)::float8 AS expense
    FROM inbox_events
    WHERE source = 'core'
      AND event_type = 'saldo.movimiento'
      AND occurred_at >= ${from}::timestamptz AND occurred_at < ${to}::timestamptz
      ${siteFilter(sedeId)}
    GROUP BY ym`;
}

// Gastos del mes: sueldos liquidados (por `periodo`, con su desglose) y gastos registrados.
export async function queryAdministrativeExpenses(
  prisma: PrismaClient,
  month: MonthRange,
  sedeId: string | null,
): Promise<ExpenseRow[]> {
  return prisma.$queryRaw<ExpenseRow[]>`
    SELECT 'sueldos-docentes' AS category,
      COALESCE(SUM((data->'desglose'->>'docentes')::numeric), 0)::float8 AS total
    FROM inbox_events
    WHERE source = 'backoffice' AND event_type = 'sueldos.liquidados'
      AND data->>'periodo' = ${month.ym} ${siteFilter(sedeId)}
    UNION ALL
    SELECT 'sueldos-administrativos',
      COALESCE(SUM((data->'desglose'->>'administrativos')::numeric), 0)::float8
    FROM inbox_events
    WHERE source = 'backoffice' AND event_type = 'sueldos.liquidados'
      AND data->>'periodo' = ${month.ym} ${siteFilter(sedeId)}
    UNION ALL
    SELECT 'sueldos-sin-desglose',
      COALESCE(SUM((data->>'monto')::numeric
        - COALESCE((data->'desglose'->>'docentes')::numeric, 0)
        - COALESCE((data->'desglose'->>'administrativos')::numeric, 0)), 0)::float8
    FROM inbox_events
    WHERE source = 'backoffice' AND event_type = 'sueldos.liquidados'
      AND data->>'periodo' = ${month.ym} ${siteFilter(sedeId)}
    UNION ALL
    SELECT data->>'categoria', SUM((data->>'monto')::numeric)::float8
    FROM inbox_events
    WHERE source = 'backoffice' AND event_type = 'gasto.registrado'
      AND occurred_at >= ${month.start}::timestamptz AND occurred_at < ${month.end}::timestamptz
      ${siteFilter(sedeId)}
    GROUP BY data->>'categoria'`;
}

// Productos del mes: ventas de compra.realizada menos lo devuelto en compra.devuelta.
export async function queryTopProducts(
  prisma: PrismaClient,
  month: MonthRange,
  sedeId: string | null,
): Promise<ProductRow[]> {
  return prisma.$queryRaw<ProductRow[]>`
    WITH lines AS (
      SELECT item->>'producto' AS producto, item->>'categoria' AS categoria,
        (item->>'unidades')::numeric AS unidades, (item->>'monto')::numeric AS monto
      FROM inbox_events, jsonb_array_elements(data->'items') AS item
      WHERE source = 'tienda' AND event_type = 'compra.realizada'
        AND occurred_at >= ${month.start}::timestamptz AND occurred_at < ${month.end}::timestamptz
        ${siteFilter(sedeId)}
      UNION ALL
      SELECT item->>'producto', item->>'categoria',
        -(item->>'unidades')::numeric, -(item->>'monto')::numeric
      FROM inbox_events, jsonb_array_elements(data->'items') AS item
      WHERE source = 'tienda' AND event_type = 'compra.devuelta'
        AND occurred_at >= ${month.start}::timestamptz AND occurred_at < ${month.end}::timestamptz
        ${siteFilter(sedeId)}
    )
    SELECT producto, MAX(categoria) AS categoria,
      SUM(unidades)::float8 AS unidades, SUM(monto)::float8 AS monto
    FROM lines
    GROUP BY producto
    HAVING SUM(unidades) > 0
    ORDER BY SUM(unidades) DESC, producto`;
}

// Facturación y tickets de comedor por sede y mes (reserva.confirmada). Sin filtro de sede: el
// tablero muestra todas las sedes y el filtro solo resalta.
export async function queryDiningRevenue(
  prisma: PrismaClient,
  from: string,
  to: string,
): Promise<DiningRow[]> {
  const rows = await prisma.$queryRaw<{ sede_id: string; ym: string; revenue: number; tickets: number }[]>`
    SELECT data->>'sedeId' AS sede_id, ${argentinaMonth()} AS ym,
      COALESCE(SUM((data->>'monto')::numeric), 0)::float8 AS revenue,
      COUNT(*)::int AS tickets
    FROM inbox_events
    WHERE source = 'comedor' AND event_type = 'reserva.confirmada'
      AND occurred_at >= ${from}::timestamptz AND occurred_at < ${to}::timestamptz
    GROUP BY sede_id, ym`;

  return rows.map((row) => ({ sedeId: row.sede_id, ym: row.ym, revenue: row.revenue, tickets: row.tickets }));
}

// Sedes que registraron alguna reserva de comedor en cualquier fecha: las que tienen servicio.
export async function queryDiningSites(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ sede_id: string }[]>`
    SELECT DISTINCT data->>'sedeId' AS sede_id
    FROM inbox_events
    WHERE source = 'comedor' AND event_type = 'reserva.confirmada'
      AND data->>'sedeId' IS NOT NULL`;

  return rows.map((row) => row.sede_id);
}

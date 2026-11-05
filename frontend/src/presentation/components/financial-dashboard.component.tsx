// Presentation components: tablero financiero. Porta 1:1 la pantalla "Situación económica y
// financiera" del prototipo (Analitica Institucional.dc.html) contra las primitivas del Paso 6.
import { useState } from "react";
import type { FinancialStats } from "@/domain/entities/analytics.entity";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "./stat-card.component";
import { DeltaLabel } from "./trend-pill.component";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";
import { EmptyState } from "./dashboard/empty-state.component";
import { DataWarnings } from "./dashboard/data-warnings.component";
import { DataSourceNote } from "./dashboard/data-source-note.component";
import { ChartLegend } from "./charts/chart-legend.component";
import { ChartTooltip } from "./charts/chart-tooltip.component";
import { GroupedBarChart, type GroupedBarCategory } from "./charts/grouped-bar-chart.component";
import { AreaLineChart } from "./charts/area-line-chart.component";
import { StackedBar } from "./charts/stacked-bar.component";
import { BarList, type BarListRow } from "./charts/bar-list.component";
import { createScale, buildGappedSeries, buildGridRows, paddedDomain } from "@/lib/chart-scale";
import { formatCount, formatLastIngestion, formatMillions, formatPercent } from "@/lib/format";

interface FinancialDashboardProps {
  stats: FinancialStats;
}

const INCOME_COLOR = "#2D5DA1";
const EXPENSE_COLOR = "#A51C30";
const BALANCE_COLOR = "#127453";

type ProductRanking = "units" | "revenue";

export function FinancialDashboard({ stats }: FinancialDashboardProps) {
  // Criterio del ranking de productos; solo estado local.
  const [ranking, setRanking] = useState<ProductRanking>("units");
  const hasBalanceData = stats.monthlyBalance.some((m) => m.income !== 0 || m.expense !== 0 || (m.balance ?? 0) !== 0);
  const maxBar = Math.max(1, ...stats.monthlyBalance.flatMap((m) => [m.income, m.expense]));
  const balanceCategories: GroupedBarCategory[] = stats.monthlyBalance.map((month) => {
    const incomeHeight = `${(month.income / maxBar) * 100}%`;
    const expenseHeight = `${(month.expense / maxBar) * 100}%`;
    return {
      key: month.month,
      barHeights: [incomeHeight, expenseHeight],
      tooltipAnchorHeight: incomeHeight,
      tooltip: (
        <ChartTooltip
          minWidth={186}
          rows={[
            { color: INCOME_COLOR, label: "Ingresos", value: month.formattedIncome },
            { color: EXPENSE_COLOR, label: "Egresos", value: month.formattedExpense },
            { label: "Resultado", value: month.formattedResult, emphasized: true },
          ]}
        />
      ),
      footer: <span className="text-[10.5px] text-[#6E7A90]">{month.shortMonth}</span>,
    };
  });

  const balanceValues = stats.monthlyBalance.map((m) => m.balance);
  // balance null = mes sin snapshot: queda un hueco en la serie, no un 0.
  const knownBalances = balanceValues.filter((value): value is number => value !== null);
  const { min: balanceLo, max: balanceHi } = paddedDomain(knownBalances);
  const balanceScale = createScale({
    pointCount: balanceValues.length,
    domainMin: balanceLo,
    domainMax: balanceHi,
    marginLeft: 46,
    plotWidth: 578,
    marginTop: 14,
    plotHeight: 128,
  });
  const balanceGridValues = (knownBalances.length > 0 ? [0, 1, 2, 3] : []).map((k) => balanceHi - ((balanceHi - balanceLo) * k) / 3);
  const balanceGrid = buildGridRows(
    balanceGridValues,
    { domainMin: balanceLo, domainMax: balanceHi, marginTop: 14, plotHeight: 128 },
    (value) => formatMillions(value),
  );
  const balanceSeries = buildGappedSeries(balanceValues, balanceScale, 142);
  const selectedBalance = stats.monthlyBalance.find((m) => m.isSelected);

  const maxDining = Math.max(1, ...stats.diningRevenues.map((d) => d.revenue));

  const expenseRows: BarListRow[] = stats.administrativeExpenses.map((expense) => ({
    key: expense.category,
    swatchColor: expense.color,
    primaryLabel: expense.category,
    valueLabel: expense.formattedAmount,
    secondaryValueLabel: formatPercent(expense.percentage),
  }));

  const rankedProducts = ranking === "units" ? stats.topSellingProducts : stats.topRevenueProducts;
  const productMetric = (product: (typeof rankedProducts)[number]) =>
    ranking === "units" ? product.unitsSold : product.revenue;
  const maxProductMetric = Math.max(1, ...rankedProducts.map(productMetric));

  const productRows: BarListRow[] = rankedProducts.map((product) => ({
    key: product.productName,
    primaryLabel: product.productName,
    secondaryLabel: `${product.category} · ${formatCount(product.unitsSold)} u`,
    bar: { color: "#2D5DA1", widthPercent: (productMetric(product) / maxProductMetric) * 100 },
    valueLabel: product.formattedRevenue,
  }));

  return (
    <div className="flex flex-col gap-4">
      <DataWarnings warnings={stats.warnings} notice={stats.siteScopeNote} />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.formattedValue}
            unit={kpi.unit || undefined}
            delta={kpi.delta}
            note={kpi.note}
            comparisonLabel={`vs. ${stats.previousMonth}`}
            size="compact"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.32fr_1fr]">
        <SectionCard className="px-5 pt-[18px] pb-3.5">
          <SectionHeader
            title="Balance de saldo"
            description="Ingresos contra egresos por mes y evolución del saldo acumulado"
            right={
              <ChartLegend
                items={[
                  { key: "ingresos", color: INCOME_COLOR, label: "Ingresos" },
                  { key: "egresos", color: EXPENSE_COLOR, label: "Egresos" },
                  { key: "saldo", shape: "line", color: BALANCE_COLOR, label: "Saldo acumulado" },
                ]}
              />
            }
          />
          {hasBalanceData ? (
            <>
          <GroupedBarChart
            seriesColors={[INCOME_COLOR, EXPENSE_COLOR]}
            categories={balanceCategories}
            heightPx={168}
            columnGap="14px"
            columnPadding="0 8%"
            barGap="5px"
          />
          <AreaLineChart
            label="Saldo acumulado"
            valueLabel={selectedBalance?.formattedBalance ?? stats.kpis[0]?.formattedValue ?? ""}
            grid={balanceGrid}
            points={balanceSeries.lines}
            areaPoints={balanceSeries.areas}
            dots={balanceSeries.dots}
            color={BALANCE_COLOR}
          />
            </>
          ) : (
            <EmptyState message="Todavía no hay movimientos para este período" />
          )}
        </SectionCard>

        <SectionCard className="px-5 py-[18px]">
          <SectionHeader
            title="Gastos administrativos"
            description={`Composición de egresos de ${stats.month}, salarios incluidos`}
          />
          {stats.administrativeExpenses.some((expense) => expense.amount > 0) ? (
            <>
              <StackedBar
                segments={stats.administrativeExpenses.map((expense) => ({
                  key: expense.category,
                  color: expense.color,
                  widthPercent: expense.percentage,
                }))}
              />
              <BarList rows={expenseRows} columns="1fr 96px 52px" />
            </>
          ) : (
            <EmptyState message="Todavía no hay egresos registrados para este período" />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <SectionCard className="px-5 py-[18px]">
          <SectionHeader
            title="Productos más vendidos · Tienda del Campus"
            description={`${ranking === "units" ? "Por unidades vendidas" : "Por facturación"} en ${stats.month}`}
            right={
              <Tabs value={ranking} onValueChange={(value) => setRanking(value as ProductRanking)}>
                <TabsList aria-label="Criterio del ranking de productos" className="h-8 bg-[#EEF1F6]">
                  {([["units", "Unidades"], ["revenue", "Facturación"]] as const).map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="px-3 text-xs text-[#647188] hover:text-[#16243C] data-active:bg-white data-active:text-[#16243C]"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            }
          />
          {productRows.length > 0 ? (
            <BarList rows={productRows} columns="180px 1fr 92px" />
          ) : (
            <EmptyState message="Todavía no hay ventas de la tienda para este período" />
          )}
        </SectionCard>

        <SectionCard className="px-5 py-[18px]">
          <SectionHeader
            title="Facturación de comedores por sede"
            description={`${stats.month} · ticket promedio y variación mensual`}
          />

          {/* overflow-x-auto + minWidth compartido: en mobile, con ~5 sedes y bastante texto por
              columna (nombre, monto, tickets, ticket promedio, delta), scrollea en vez de aplastar
              cada columna hasta volverla ilegible. */}
          {!stats.diningRevenues.some((dining) => dining.hasService && dining.revenue > 0) ? (
            <EmptyState message="Todavía no hay reservas de comedor para este período" />
          ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: stats.diningRevenues.length * 84 }}>
              <div className="relative border-b border-[#DCE1E8]" style={{ height: 132 }}>
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  <div className="border-t border-dashed border-[#DCE1E8]" />
                  <div className="border-t border-dashed border-[#DCE1E8]" />
                  <div className="border-t border-dashed border-[#DCE1E8]" />
                </div>
                <div
                  className="relative grid items-end"
                  style={{ gridTemplateColumns: `repeat(${stats.diningRevenues.length}, 1fr)`, gap: 16, height: 132 }}
                >
                  {stats.diningRevenues.map((dining) => (
                    <div
                      key={dining.siteName}
                      className="flex items-end justify-center"
                      style={{ height: 132, padding: "0 18%", opacity: dining.isSelected ? 1 : 0.55 }}
                    >
                      <div
                        className="w-full rounded-t"
                        style={{
                          background: dining.isSelected ? "#2D5DA1" : "#C6D5EA",
                          height: `${(dining.revenue / maxDining) * 100}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="grid pt-2.5"
                style={{ gridTemplateColumns: `repeat(${stats.diningRevenues.length}, 1fr)`, gap: 16 }}
              >
                {stats.diningRevenues.map((dining) => (
                  <div
                    key={dining.siteName}
                    className="flex flex-col items-center gap-[3px] text-center"
                    style={{ opacity: dining.isSelected ? 1 : 0.55 }}
                  >
                    <span className="text-[11px] font-medium text-[#2A3A57]">{dining.siteName}</span>
                    <span className="text-[12.5px] font-semibold whitespace-nowrap text-[#16243C]">{dining.formattedRevenue}</span>
                    <span className="text-[10.5px] text-[#7A8598]">
                      {dining.hasService ? `${formatCount(dining.ticketsCount)} tickets` : dining.note}
                    </span>
                    {dining.hasService && (
                      <span className="text-[10.5px] text-[#6E7A90]">ticket {dining.formattedAverageTicket}</span>
                    )}
                    {dining.hasService && (
                      <DeltaLabel label={dining.delta.formatted} tone={dining.delta.tone} className="text-[11px] font-medium" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </SectionCard>
      </div>

      <DataSourceNote>
        Agregados desde eventos de Finanzas, Tienda y Comedores · valores en millones de ARS · última ingesta{" "}
        {formatLastIngestion(stats.lastIngestionAt)}
      </DataSourceNote>
    </div>
  );
}

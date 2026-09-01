// Presentation components: tablero financiero. Porta 1:1 la pantalla "Situación económica y
// financiera" del prototipo (Analitica Institucional.dc.html) contra las primitivas del Paso 6.
import type { FinancialStats } from "@/domain/entities/analytics.entity";
import { StatCard } from "./stat-card.component";
import { DeltaLabel } from "./trend-pill.component";
import { SectionCard } from "./dashboard/section-card.component";
import { SectionHeader } from "./dashboard/section-header.component";
import { DataSourceNote } from "./dashboard/data-source-note.component";
import { ChartLegend } from "./charts/chart-legend.component";
import { ChartTooltip } from "./charts/chart-tooltip.component";
import { GroupedBarChart, type GroupedBarCategory } from "./charts/grouped-bar-chart.component";
import { AreaLineChart } from "./charts/area-line-chart.component";
import { StackedBar } from "./charts/stacked-bar.component";
import { BarList, type BarListRow } from "./charts/bar-list.component";
import { createScale, buildPolylinePoints, buildAreaPoints, buildDots, buildGridRows } from "@/lib/chart-scale";
import { formatCount, formatMillions, formatPercent } from "@/lib/format";

interface FinancialDashboardProps {
  stats: FinancialStats;
}

const INCOME_COLOR = "#2D5DA1";
const EXPENSE_COLOR = "#A51C30";
const BALANCE_COLOR = "#127453";

export function FinancialDashboard({ stats }: FinancialDashboardProps) {
  const maxIncome = Math.max(...stats.monthlyBalance.map((m) => m.income));
  const balanceCategories: GroupedBarCategory[] = stats.monthlyBalance.map((month) => {
    const incomeHeight = `${(month.income / maxIncome) * 100}%`;
    const expenseHeight = `${(month.expense / maxIncome) * 100}%`;
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
  const balanceLo = Math.min(...balanceValues) * 0.94;
  const balanceHi = Math.max(...balanceValues) * 1.03;
  const balanceScale = createScale({
    pointCount: 6,
    domainMin: balanceLo,
    domainMax: balanceHi,
    marginLeft: 46,
    plotWidth: 578,
    marginTop: 14,
    plotHeight: 128,
  });
  const balanceGridValues = [0, 1, 2, 3].map((k) => balanceHi - ((balanceHi - balanceLo) * k) / 3);
  const balanceGrid = buildGridRows(
    balanceGridValues,
    { domainMin: balanceLo, domainMax: balanceHi, marginTop: 14, plotHeight: 128 },
    (value) => formatMillions(value),
  );
  const selectedBalance = stats.monthlyBalance.find((m) => m.isSelected);

  const maxDining = Math.max(...stats.diningRevenues.map((d) => d.revenue));
  const maxProductRevenue = Math.max(...stats.topSellingProducts.map((p) => p.revenue));

  const expenseRows: BarListRow[] = stats.administrativeExpenses.map((expense) => ({
    key: expense.category,
    swatchColor: expense.color,
    primaryLabel: expense.category,
    valueLabel: expense.formattedAmount,
    secondaryValueLabel: formatPercent(expense.percentage),
  }));

  const productRows: BarListRow[] = stats.topSellingProducts.map((product) => ({
    key: product.productName,
    primaryLabel: product.productName,
    secondaryLabel: `${product.category} · ${formatCount(product.unitsSold)} u`,
    bar: { color: "#2D5DA1", widthPercent: (product.revenue / maxProductRevenue) * 100 },
    valueLabel: product.formattedRevenue,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.formattedValue}
            unit={kpi.unit || undefined}
            delta={kpi.delta}
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
            points={buildPolylinePoints(balanceValues, balanceScale)}
            areaPoints={buildAreaPoints(balanceValues, balanceScale, 142)}
            dots={buildDots(balanceValues, balanceScale)}
            color={BALANCE_COLOR}
          />
        </SectionCard>

        <SectionCard className="px-5 py-[18px]">
          <SectionHeader
            title="Gastos administrativos"
            description={`Composición de egresos de ${stats.month}, salarios incluidos`}
          />
          <StackedBar
            segments={stats.administrativeExpenses.map((expense) => ({
              key: expense.category,
              color: expense.color,
              widthPercent: expense.percentage,
            }))}
          />
          <BarList rows={expenseRows} columns="1fr 96px 52px" />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <SectionCard className="px-5 py-[18px]">
          <SectionHeader title="Productos más vendidos · Tienda del Campus" description={`Por facturación en ${stats.month}`} />
          <BarList rows={productRows} columns="180px 1fr 92px" />
        </SectionCard>

        <SectionCard className="px-5 py-[18px]">
          <SectionHeader
            title="Facturación de comedores por sede"
            description={`${stats.month} · ticket promedio y variación mensual`}
          />

          {/* overflow-x-auto + minWidth compartido: en mobile, con ~5 sedes y bastante texto por
              columna (nombre, monto, tickets, ticket promedio, delta), scrollea en vez de aplastar
              cada columna hasta volverla ilegible. */}
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
                    <span className="text-[10.5px] text-[#6E7A90]">ticket {dining.formattedAverageTicket}</span>
                    {dining.hasService && (
                      <DeltaLabel label={dining.delta.formatted} tone={dining.delta.tone} className="text-[11px] font-medium" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <DataSourceNote>
        Datos de ejemplo · agregados desde eventos de Finanzas, Tienda y Comedores · valores en millones de ARS
      </DataSourceNote>
    </div>
  );
}

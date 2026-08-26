// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import type { FinancialStats } from "@/domain/entities/analytics.entity";
import { StatCard } from "./stat-card.component";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

interface FinancialDashboardProps {
  stats: FinancialStats;
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function FinancialDashboard({ stats }: FinancialDashboardProps) {
  const totalBalance = stats.institutionalBalances.reduce((sum, b) => sum + b.balance, 0);
  const totalExpenses = stats.administrativeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDiningRevenue = stats.diningRevenues.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Saldo total institucional" value={currencyFormatter.format(totalBalance)} />
        <StatCard label="Gastos administrativos" value={currencyFormatter.format(totalExpenses)} />
        <StatCard label="Facturación de comedores" value={currencyFormatter.format(totalDiningRevenue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balances por sede</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.institutionalBalances.map((row) => (
                  <TableRow key={row.siteName}>
                    <TableCell>{row.siteName}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos administrativos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.administrativeExpenses.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(row.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Facturación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topSellingProducts.map((row) => (
                  <TableRow key={row.productName}>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell className="text-right">{row.unitsSold}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturación de comedores por sede</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Facturación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.diningRevenues.map((row) => (
                  <TableRow key={row.siteName}>
                    <TableCell>{row.siteName}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

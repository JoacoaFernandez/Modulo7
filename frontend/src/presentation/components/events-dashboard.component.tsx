// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import type { EventStats } from "@/domain/entities/analytics.entity";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ApprovalRateBadge } from "./approval-rate-badge.component";

interface EventsDashboardProps {
  stats: EventStats[];
}

export function EventsDashboard({ stats }: EventsDashboardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estadísticas de eventos académicos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead className="text-right">Frecuencia</TableHead>
              <TableHead className="text-right">Concurrencia</TableHead>
              <TableHead className="text-right">Cupo</TableHead>
              <TableHead className="text-right">Presentismo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((row) => (
              <TableRow key={row.eventName}>
                <TableCell>{row.eventName}</TableCell>
                <TableCell className="text-right">{row.frequency}</TableCell>
                <TableCell className="text-right">{row.attendeesCount}</TableCell>
                <TableCell className="text-right">{row.capacity}</TableCell>
                <TableCell className="text-right">
                  <ApprovalRateBadge rate={row.attendanceRate} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

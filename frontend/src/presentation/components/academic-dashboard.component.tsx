// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import type { AcademicStats } from "@/domain/entities/analytics.entity";
import { StatCard } from "./stat-card.component";
import { ApprovalRateBadge } from "./approval-rate-badge.component";
import { ApprovalRateBarList } from "./approval-rate-bar-list.component";
import { ApprovalHistoryChart } from "./approval-history-chart.component";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

interface AcademicDashboardProps {
  stats: AcademicStats;
}

export function AcademicDashboard({ stats }: AcademicDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Materias en curso"
          value={String(stats.activeSubjectsCount)}
          trend={{ label: stats.activeSubjectsTrend, tone: "positive" }}
        />
        <StatCard
          label="Tasa de aprobación general"
          value={`${Math.round(stats.overallApprovalRate * 100)}%`}
          trend={{ label: stats.overallApprovalRateTrend, tone: "positive" }}
        />
        <StatCard
          label="Docentes evaluados"
          value={String(stats.evaluatedTeachersCount)}
          trend={{ label: `${stats.subjectsWithoutDataCount} materias sin datos`, tone: "warning" }}
        />
      </div>

      <ApprovalRateBarList
        title="Tasa de aprobación por materia"
        description="Cuatrimestres anteriores segmentados por materia"
        rows={stats.subjectApprovalRates.map((row) => ({ label: row.subjectName, approvalRate: row.approvalRate }))}
      />

      <ApprovalHistoryChart
        title="Evolución de la tasa de aprobación general"
        description="Últimos cuatrimestres"
        points={stats.approvalRateHistory}
      />

      <Card>
        <CardHeader>
          <CardTitle>Tasa de aprobación por docente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Docente</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead className="text-right">Aprobación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.teacherApprovalRates.map((row) => (
                <TableRow key={`${row.teacherName}-${row.subjectName}`}>
                  <TableCell>{row.teacherName}</TableCell>
                  <TableCell>{row.subjectName}</TableCell>
                  <TableCell className="text-right">
                    <ApprovalRateBadge rate={row.approvalRate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

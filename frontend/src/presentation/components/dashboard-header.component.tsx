// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardHeaderProps {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}

export function DashboardHeader({ eyebrow, title, actions }: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-8 py-6">
      <div>
        <p className="text-sm text-muted-foreground">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </header>
  );
}

export function QuarterFilter() {
  return (
    <Select defaultValue="2c-2026">
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Cuatrimestre" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="2c-2026">Cuatrimestre: 2C 2026</SelectItem>
        <SelectItem value="1c-2026">Cuatrimestre: 1C 2026</SelectItem>
        <SelectItem value="2c-2025">Cuatrimestre: 2C 2025</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function SiteFilter() {
  return (
    <Select defaultValue="all">
      <SelectTrigger className="w-36">
        <SelectValue placeholder="Sede" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Sede: Todas</SelectItem>
        <SelectItem value="recoleta">Sede: Recoleta</SelectItem>
        <SelectItem value="villa-maria">Sede: Villa María</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ExportReportButton() {
  return <Button>Exportar reporte</Button>;
}

// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendPill, type TrendTone } from "./trend-pill.component";

interface StatCardProps {
  label: string;
  value: string;
  trend?: { label: string; tone: TrendTone };
}

export function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-3xl font-bold">{value}</p>
        {trend && <TrendPill label={trend.label} tone={trend.tone} />}
      </CardContent>
    </Card>
  );
}

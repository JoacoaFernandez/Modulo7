// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface ApprovalRateBarListProps {
  title: string;
  description: string;
  rows: { label: string; approvalRate: number }[];
}

function barColor(rate: number) {
  if (rate >= 0.7) return "bg-green-500";
  if (rate >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

export function ApprovalRateBarList({ title, description, rows }: ApprovalRateBarListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-4">
            <span className="w-56 shrink-0 truncate text-sm">{row.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", barColor(row.approvalRate))}
                style={{ width: `${Math.round(row.approvalRate * 100)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-semibold">
              {Math.round(row.approvalRate * 100)}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

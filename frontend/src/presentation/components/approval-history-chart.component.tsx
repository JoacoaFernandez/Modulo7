// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface ApprovalHistoryChartProps {
  title: string;
  description: string;
  points: { quarter: string; approvalRate: number }[];
}

export function ApprovalHistoryChart({ title, description, points }: ApprovalHistoryChartProps) {
  const maxRate = Math.max(...points.map((p) => p.approvalRate), 0.01);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4 px-2">
          {points.map((point, index) => {
            const isLast = index === points.length - 1;
            return (
              <div key={point.quarter} className="flex flex-1 flex-col items-center gap-2">
                <span className={cn("text-sm font-semibold", isLast ? "text-indigo-600" : "text-foreground")}>
                  {Math.round(point.approvalRate * 100)}%
                </span>
                <div className="flex h-32 w-full items-end justify-center">
                  <div
                    className={cn("w-8 rounded-md", isLast ? "bg-indigo-600" : "bg-indigo-200")}
                    style={{ height: `${(point.approvalRate / maxRate) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{point.quarter}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

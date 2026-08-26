// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import { Badge } from "@/components/ui/badge";

interface ApprovalRateBadgeProps {
  rate: number;
}

export function ApprovalRateBadge({ rate }: ApprovalRateBadgeProps) {
  const percentage = Math.round(rate * 100);
  const variant = rate >= 0.7 ? "default" : rate >= 0.5 ? "secondary" : "destructive";

  return <Badge variant={variant}>{percentage}%</Badge>;
}

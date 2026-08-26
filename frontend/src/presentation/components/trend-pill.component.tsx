// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import { cn } from "@/lib/utils";

export type TrendTone = "positive" | "warning" | "negative";

interface TrendPillProps {
  label: string;
  tone: TrendTone;
}

const toneClasses: Record<TrendTone, string> = {
  positive: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  negative: "bg-red-50 text-red-700 border-red-200",
};

export function TrendPill({ label, tone }: TrendPillProps) {
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium", toneClasses[tone])}>
      {label}
    </span>
  );
}

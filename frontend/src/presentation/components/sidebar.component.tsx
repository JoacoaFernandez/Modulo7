// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
import { cn } from "@/lib/utils";

export type AnalyticsSection = "academic" | "financial" | "events";

interface NavItem {
  section: AnalyticsSection;
  label: string;
  enabled: true;
}

interface DisabledNavItem {
  section: null;
  label: string;
  enabled: false;
}

const navItems: (NavItem | DisabledNavItem)[] = [
  { section: null, label: "Resumen", enabled: false },
  { section: "academic", label: "Académico", enabled: true },
  { section: "financial", label: "Financiero", enabled: true },
  { section: "events", label: "Eventos", enabled: true },
  { section: null, label: "Pipeline de eventos", enabled: false },
];

interface SidebarProps {
  activeSection: AnalyticsSection;
  onSelectSection: (section: AnalyticsSection) => void;
}

export function Sidebar({ activeSection, onSelectSection }: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col gap-6 bg-[#12131a] px-4 py-6 text-white">
      <div className="flex items-center gap-2 px-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold">
          U
        </div>
        <span className="text-base font-semibold">UADEnet</span>
      </div>

      <nav className="flex flex-col gap-1">
        <p className="px-2 pb-1 text-xs font-medium tracking-wide text-white/40">ANALÍTICA</p>
        {navItems.map((item) => {
          const isActive = item.enabled && item.section === activeSection;
          return (
            <button
              key={item.label}
              type="button"
              disabled={!item.enabled}
              onClick={() => item.enabled && onSelectSection(item.section)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                item.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                isActive ? "bg-white/10 font-semibold text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  isActive ? "bg-indigo-400" : "bg-white/30",
                )}
              />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

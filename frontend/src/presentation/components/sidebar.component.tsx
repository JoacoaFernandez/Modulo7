// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
// Colores, espaciados y textos porteados 1:1 del <aside> del prototipo (Analitica Institucional.dc.html).
// Debajo de `lg` pasa a ser un drawer off-canvas (no está en el prototipo, que es solo desktop).
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// El diseño no tiene una tercera sección "eventos": esa vista vive *dentro* del tablero
// académico, en un <section id="eventos"> (mismo rol "academica"). Por eso
// "Eventos académicos" no navega a otra sección, solo hace scroll. "Fuentes de datos" es la
// única sección que no depende del rol: la ven todos los usuarios.
export type AnalyticsSection = "academic" | "financial" | "sources";

interface SidebarProps {
  // Tableros que los roles del usuario pueden ver (la dirección académica no ve el financiero).
  availableSections: AnalyticsSection[];
  activeSection: AnalyticsSection;
  onSelectSection: (section: AnalyticsSection) => void;
  // Controla el drawer en mobile/tablet (<lg); en desktop el aside queda siempre visible.
  isOpen: boolean;
  onClose: () => void;
}

function scrollToEventsAnchor() {
  setTimeout(() => {
    const el = document.getElementById("eventos");
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
  }, 60);
}

interface NavItem {
  label: string;
  hint?: string;
  // Ítem indentado, tipografía más chica: solo "Eventos académicos".
  sub?: boolean;
  isActive: boolean;
  onClick?: () => void;
}

export function Sidebar({ availableSections, activeSection, onSelectSection, isOpen, onClose }: SidebarProps) {
  const goTo = (section: AnalyticsSection) => () => {
    onSelectSection(section);
    onClose();
  };

  // Ítems del diseño, en su orden. "Eventos académicos" es un atajo con scroll que el
  // prototipo nunca resalta. "Permisos por rol" no está: los permisos los administra
  // Backoffice (módulo 8), no Analítica.
  const hasAcademic = availableSections.includes("academic");
  const hasFinancial = availableSections.includes("financial");

  const navItems: NavItem[] = [
    ...(hasAcademic
      ? [
          { label: "Académica", isActive: activeSection === "academic", onClick: goTo("academic") },
          {
            label: "Eventos académicos",
            sub: true,
            isActive: false,
            onClick: () => {
              onSelectSection("academic");
              scrollToEventsAnchor();
              onClose();
            },
          },
        ]
      : []),
    ...(hasFinancial
      ? [{ label: "Financiera", isActive: activeSection === "financial", onClick: goTo("financial") }]
      : []),
    { label: "Fuentes de datos", hint: "9", isActive: activeSection === "sources", onClick: goTo("sources") },
  ];

  return (
    <>
      {/* Backdrop del drawer: solo existe (y bloquea clics) mientras está abierto en <lg. */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-[232px] shrink-0 flex-col gap-[26px] bg-[var(--navy)] px-4 py-[22px] transition-transform duration-200 ease-out lg:static lg:h-auto lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-[9px] px-2">
          <div className="flex items-center gap-[9px]">
            <span className="size-3 shrink-0 rounded-[3px] bg-[var(--blue)]" />
            <span className="font-heading text-[17px] tracking-[0.01em] text-white">UADEnet</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="cursor-pointer rounded-md p-1 text-[#C3CCD9] hover:bg-[#243755] lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md text-left font-medium transition-colors hover:bg-[#243755]",
                item.sub ? "py-[7px] pr-2.5 pl-6 text-[12.5px]" : "px-2.5 py-[9px] text-[13px]",
                item.onClick ? "cursor-pointer" : "cursor-default",
                item.isActive ? "bg-[var(--blue)] text-white" : item.sub ? "text-[#A9B6C8]" : "text-[#C3CCD9]",
              )}
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-[10px] text-[#8494AB]">{item.hint}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-[#2A3A57] p-3">
          <p className="text-[10px] font-medium tracking-[0.12em] text-[#8494AB] uppercase">Ingesta</p>
          <p className="text-[11.5px] leading-[1.5] text-[#D3DAE4]">
            Eventos recolectados de los 9 módulos de UADEnet.
          </p>
        </div>
      </aside>
    </>
  );
}

// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
// Estructura y colores porteados 1:1 del <header> del prototipo (Analitica Institucional.dc.html):
// selects nativos en pill, no el <Select> de shadcn (el diseño no usa dropdown con popover).
// Debajo de `lg` el header envuelve en dos filas y suma el botón de menú del Sidebar.
import { Menu } from "lucide-react";

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <label className="flex items-center gap-[7px] rounded-[7px] border border-[#DCE1E8] bg-[var(--app-bg)] px-2.5 py-[7px]">
      <span className="text-[10px] font-medium tracking-[0.1em] text-[#647188] uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer border-0 bg-transparent text-[13px] font-medium text-[var(--navy)] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface DashboardHeaderProps {
  eyebrow: string;
  title: string;
  siteName: string;
  siteOptions: string[];
  onSiteChange: (value: string) => void;
  // "Cuatrimestre" en el tablero académico, "Período" en el resto.
  periodLabel: string;
  periodValue: string;
  periodOptions: string[];
  onPeriodChange: (value: string) => void;
  // "Cambiar rol": vuelve al selector de rol (conserva sede/período elegidos).
  onChangeRole: () => void;
  // Abre el drawer del Sidebar; el botón que lo dispara solo se ve en <lg.
  onOpenMenu: () => void;
}

export function DashboardHeader({
  eyebrow,
  title,
  siteName,
  siteOptions,
  onSiteChange,
  periodLabel,
  periodValue,
  periodOptions,
  onPeriodChange,
  onChangeRole,
  onOpenMenu,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-[var(--app-border)] bg-white px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-7 lg:py-[18px]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
          className="-ml-1 shrink-0 cursor-pointer rounded-md p-1.5 text-[#41506B] hover:bg-[var(--app-bg)] lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex flex-col gap-[3px]">
          <p className="text-[11.5px] text-[#6E7A90]">{eyebrow}</p>
          <h1 className="font-heading text-[19px] leading-[1.2] tracking-[-0.01em] text-[#16243C] sm:text-[21px]">{title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterSelect label="Sede" value={siteName} options={siteOptions} onChange={onSiteChange} />
        <FilterSelect label={periodLabel} value={periodValue} options={periodOptions} onChange={onPeriodChange} />
        <button
          type="button"
          onClick={onChangeRole}
          className="cursor-pointer rounded-[7px] border border-[#DCE1E8] bg-white px-3 py-2 text-[12.5px] font-medium text-[#41506B] transition-colors hover:border-[var(--blue)] hover:text-[var(--navy)]"
        >
          Cambiar rol
        </button>
      </div>
    </header>
  );
}

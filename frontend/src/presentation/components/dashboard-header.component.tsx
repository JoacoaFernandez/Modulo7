// Presentation components: app-specific components composed from shadcn/ui primitives (components/ui).
// Estructura y colores porteados 1:1 del <header> del prototipo (Analitica Institucional.dc.html):
// selects nativos en pill, no el <Select> de shadcn (el diseño no usa dropdown con popover).

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
}: DashboardHeaderProps) {
  return (
    <header className="flex min-w-[1180px] items-center justify-between gap-6 border-b border-[var(--app-border)] bg-white px-7 py-[18px]">
      <div className="flex flex-col gap-[3px]">
        <p className="text-[11.5px] text-[#6E7A90]">{eyebrow}</p>
        <h1 className="font-heading text-[21px] leading-[1.2] tracking-[-0.01em] text-[#16243C]">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
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

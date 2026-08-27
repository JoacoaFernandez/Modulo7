// Presentation components: layout compartido por los 3 tableros.
// Nota de pie con punto verde: "Datos de ejemplo · agregados desde eventos de ... · última
// ingesta {fecha}". Aparece una vez al final de cada tablero.
import type { ReactNode } from "react";

interface DataSourceNoteProps {
  children: ReactNode;
}

export function DataSourceNote({ children }: DataSourceNoteProps) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] leading-[1.5] text-[#6E7A90]">
      <span className="size-1.5 shrink-0 rounded-full bg-[var(--green)]" />
      {children}
    </div>
  );
}

// Presentation components: layout compartido por los 3 tableros.
// Encabezado de sección: título (Libre Caslon) + bajada, con espacio a la derecha para una
// leyenda (`ChartLegend`) o un total — el mismo patrón se repite en cada una de las ~10
// secciones del prototipo.
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description: string;
  right?: ReactNode;
  marginBottom?: string;
}

export function SectionHeader({ title, description, right, marginBottom = "18px" }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4" style={{ marginBottom }}>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-[17px] leading-[1.25] text-[#16243C]">{title}</h2>
        <p className="text-xs leading-[1.4] text-[#647188]">{description}</p>
      </div>
      {right}
    </div>
  );
}

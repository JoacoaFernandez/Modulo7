// Presentation components: layout compartido por los 3 tableros (no es un gráfico en sí).
// Card blanca con borde que envuelve cada bloque de un tablero — mismo `border`/`radius` en
// las ~10 secciones del prototipo, el padding varía por sección así que queda por className.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
}

export function SectionCard({ children, className }: SectionCardProps) {
  return (
    <section className={cn("min-w-0 rounded-[10px] border border-[var(--app-border)] bg-white", className)}>
      {children}
    </section>
  );
}

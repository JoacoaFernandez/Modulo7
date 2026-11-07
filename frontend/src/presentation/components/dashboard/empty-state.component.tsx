// Presentation components: layout compartido por los 3 tableros.
// Mensaje para gráficos, tablas o listas sin datos: los tableros salen de eventos reales, así
// que un período o sede sin eventos llega con listas vacías o en cero.
interface EmptyStateProps {
  message?: string;
  className?: string;
}

export function EmptyState({ message = "Todavía no hay datos para este período", className }: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-[96px] items-center justify-center rounded-lg border border-dashed border-[#DCE1E8] px-4 py-6 text-center text-[12.5px] text-[#647188] ${className ?? ""}`}
    >
      {message}
    </div>
  );
}

// Presentation components: pantalla de carga breve mientras se restaura la sesión.
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--app-bg)]" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-[var(--navy)]">
        <div className="flex size-9 animate-pulse items-center justify-center rounded-lg bg-[var(--blue)] text-sm font-bold text-white">
          U
        </div>
        <p className="text-xs text-muted-foreground">Restaurando sesión…</p>
      </div>
    </div>
  );
}

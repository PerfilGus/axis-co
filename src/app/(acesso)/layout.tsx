/**
 * Telas fora da sessão completa: login, primeiro acesso e política de
 * privacidade. Coluna única, centrada, pensada primeiro para o iPhone.
 */
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md flex-1 flex-col gap-8">
        <div className="flex items-center gap-2 text-fg">
          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-bold text-[var(--accent-fg)]">
            A
          </span>
          <span className="text-[17px] font-medium tracking-tight">Axis</span>
        </div>
        {children}
      </div>
    </div>
  );
}

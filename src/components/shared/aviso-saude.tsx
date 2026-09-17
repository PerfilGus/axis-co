import { cn } from "@/lib/utils";
import { Icone } from "@/components/icone";

/**
 * Aviso dos campos livres sobre cliente. Dado de saúde é sensível pela LGPD e
 * não tem por que estar num pedido de suplemento.
 */
export function AvisoSaude({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-fg/90", className)}>
      <Icone nome="info" size={13} className="mt-px shrink-0" />
      Não registre informações de saúde do cliente (doenças, remédios, gestação, condições).
    </p>
  );
}

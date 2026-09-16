import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/format";

const SEGMENTOS = 24;

/**
 * Avatar com anel tracejado na cor de destaque, representando o progresso
 * do nível. O anel é desenhado como segmentos discretos: os já conquistados
 * ficam na cor de destaque, os demais na cor da borda.
 */
export function AvatarAnel({
  nome,
  imagemUrl,
  progresso = 0,
  tamanho = 40,
  className,
  mostrarAnel = true,
}: {
  nome: string;
  imagemUrl?: string | null;
  /** 0 a 1. */
  progresso?: number;
  tamanho?: number;
  className?: string;
  mostrarAnel?: boolean;
}) {
  const espessura = Math.max(2, Math.round(tamanho * 0.06));
  const raio = tamanho / 2 - espessura / 2;
  const centro = tamanho / 2;
  const conquistados = Math.round(Math.min(Math.max(progresso, 0), 1) * SEGMENTOS);
  const interno = tamanho - espessura * 2 - Math.round(tamanho * 0.07);

  // Cada segmento ocupa 60% do seu setor; o resto vira o vão do tracejado.
  const passo = (Math.PI * 2) / SEGMENTOS;
  const arco = passo * 0.6;

  // Arredonda: o último dígito de seno e cosseno varia entre o Node e o
  // navegador, e o `d` do caminho divergiria na hidratação.
  const arredondar = (n: number) => Math.round(n * 1000) / 1000;
  const ponto = (angulo: number) => [
    arredondar(centro + raio * Math.cos(angulo)),
    arredondar(centro + raio * Math.sin(angulo)),
  ];

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: tamanho, height: tamanho }}
    >
      {mostrarAnel && (
        <svg
          width={tamanho}
          height={tamanho}
          viewBox={`0 0 ${tamanho} ${tamanho}`}
          className="absolute inset-0"
          aria-hidden
        >
          {Array.from({ length: SEGMENTOS }, (_, i) => {
            const inicio = -Math.PI / 2 + i * passo;
            const [x1, y1] = ponto(inicio);
            const [x2, y2] = ponto(inicio + arco);
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} A ${raio} ${raio} 0 0 1 ${x2} ${y2}`}
                fill="none"
                strokeWidth={espessura}
                strokeLinecap="round"
                stroke={i < conquistados ? "var(--accent)" : "var(--border-strong)"}
              />
            );
          })}
        </svg>
      )}
      <span
        className="flex items-center justify-center overflow-hidden rounded-full bg-surface-3 text-[11px] font-medium text-muted-fg"
        style={{ width: mostrarAnel ? interno : tamanho, height: mostrarAnel ? interno : tamanho }}
      >
        {imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagemUrl} alt={nome} className="size-full object-cover" />
        ) : (
          iniciais(nome)
        )}
      </span>
    </span>
  );
}

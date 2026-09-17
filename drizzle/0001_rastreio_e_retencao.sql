ALTER TABLE "anexos" ADD COLUMN "removido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "rastreio_removido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "finalizado_em" timestamp with time zone;--> statement-breakpoint
-- Pedidos já encerrados: a finalização é a última mudança para o status atual
-- na linha do tempo; sem esse evento, a última atualização do pedido.
UPDATE "pedidos" AS p
SET "finalizado_em" = COALESCE(
  (
    SELECT max(a."ocorrido_em")
    FROM "atividades" AS a
    WHERE a."entidade" = 'pedido'
      AND a."entidade_id" = p."id"
      AND a."dados"->>'status' = p."status"
  ),
  p."atualizado_em"
)
WHERE p."status" IN ('pago', 'cancelado', 'reembolsado');

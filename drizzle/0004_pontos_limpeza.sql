ALTER TABLE "conquistas" ALTER COLUMN "metrica" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conquistas" ALTER COLUMN "operador" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conquistas" ALTER COLUMN "valor" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conquistas" ALTER COLUMN "periodo" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "metas" ALTER COLUMN "metrica" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "metas" ALTER COLUMN "alvo" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "metas" ALTER COLUMN "vigente_desde" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conquistas" DROP COLUMN "gatilho";--> statement-breakpoint
ALTER TABLE "conquistas" DROP COLUMN "criterio";--> statement-breakpoint
ALTER TABLE "metas" DROP COLUMN "tipo";--> statement-breakpoint
ALTER TABLE "metas" DROP COLUMN "faixas";
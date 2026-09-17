CREATE TABLE "lancamentos_pontos" (
	"id" text PRIMARY KEY NOT NULL,
	"colaborador_id" text NOT NULL,
	"setor" text NOT NULL,
	"pedido_id" text,
	"pedido_codigo" text,
	"evento" text NOT NULL,
	"pontos" integer NOT NULL,
	"descricao" text NOT NULL,
	"regra_id" text,
	"atividade_id" text,
	"ocorrido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recompensas" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"valor" integer NOT NULL,
	"condicao" jsonb NOT NULL,
	"periodo" text NOT NULL,
	"setor" text,
	"colaborador_id" text,
	"vigente_desde" date NOT NULL,
	"vigente_ate" date,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recompensas_liberadas" (
	"id" text PRIMARY KEY NOT NULL,
	"recompensa_id" text NOT NULL,
	"colaborador_id" text NOT NULL,
	"janela" text NOT NULL,
	"janela_fim" date NOT NULL,
	"nome" text NOT NULL,
	"valor" integer NOT NULL,
	"liberada_em" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"pago_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "regras_pontuacao" (
	"id" text PRIMARY KEY NOT NULL,
	"setor" text NOT NULL,
	"vigente_desde" date NOT NULL,
	"pontos_fixos" integer NOT NULL,
	"adicional" text NOT NULL,
	"faixas_valor" jsonb NOT NULL,
	"pontos_por_kit" jsonb NOT NULL,
	"penalidade_bps" integer NOT NULL,
	"queda_nivel_bps" integer NOT NULL,
	"criado_por" text,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conquistas" ALTER COLUMN "gatilho" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas" ALTER COLUMN "criterio" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ALTER COLUMN "colaborador_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ALTER COLUMN "tipo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ALTER COLUMN "faixas" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas" ADD COLUMN "metrica" text DEFAULT 'agendados' NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas" ADD COLUMN "operador" text DEFAULT 'maior_igual' NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas" ADD COLUMN "valor" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas" ADD COLUMN "periodo" text DEFAULT 'diaria' NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas" ADD COLUMN "setor" text;--> statement-breakpoint
ALTER TABLE "conquistas_desbloqueadas" ADD COLUMN "janela" text DEFAULT 'unica' NOT NULL;--> statement-breakpoint
ALTER TABLE "conquistas_desbloqueadas" ADD COLUMN "pontos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ADD COLUMN "metrica" text DEFAULT 'agendados' NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ADD COLUMN "alvo" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ADD COLUMN "setor" text;--> statement-breakpoint
ALTER TABLE "metas" ADD COLUMN "vigente_desde" date DEFAULT current_date NOT NULL;--> statement-breakpoint
ALTER TABLE "metas" ADD COLUMN "vigente_ate" date;--> statement-breakpoint
ALTER TABLE "niveis" ADD COLUMN "cor" text;--> statement-breakpoint
ALTER TABLE "niveis" ADD COLUMN "beneficio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pagamentos_colaborador" ADD COLUMN "recompensa_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lancamentos_pontos" ADD CONSTRAINT "lancamentos_pontos_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recompensas" ADD CONSTRAINT "recompensas_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recompensas_liberadas" ADD CONSTRAINT "recompensas_liberadas_recompensa_id_recompensas_id_fk" FOREIGN KEY ("recompensa_id") REFERENCES "public"."recompensas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recompensas_liberadas" ADD CONSTRAINT "recompensas_liberadas_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamentos_pontos_colaborador_id_ocorrido_em_index" ON "lancamentos_pontos" USING btree ("colaborador_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "lancamentos_pontos_pedido_id_index" ON "lancamentos_pontos" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "lancamentos_pontos_ocorrido_em_index" ON "lancamentos_pontos" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "recompensas_liberadas_recompensa_id_colaborador_id_janela_index" ON "recompensas_liberadas" USING btree ("recompensa_id","colaborador_id","janela");--> statement-breakpoint
CREATE INDEX "recompensas_liberadas_colaborador_id_janela_fim_index" ON "recompensas_liberadas" USING btree ("colaborador_id","janela_fim");--> statement-breakpoint
CREATE UNIQUE INDEX "regras_pontuacao_setor_vigente_desde_index" ON "regras_pontuacao" USING btree ("setor","vigente_desde");--> statement-breakpoint
CREATE UNIQUE INDEX "conquistas_desbloqueadas_conquista_id_colaborador_id_janela_index" ON "conquistas_desbloqueadas" USING btree ("conquista_id","colaborador_id","janela");
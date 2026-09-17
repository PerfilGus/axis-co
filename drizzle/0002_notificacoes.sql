CREATE TABLE "inscricoes_push" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"criada_em" timestamp with time zone NOT NULL,
	"ultimo_envio_em" timestamp with time zone,
	CONSTRAINT "inscricoes_push_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "notificacoes_estado" (
	"usuario_id" text PRIMARY KEY NOT NULL,
	"lidas_ate" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacoes_lidas" (
	"usuario_id" text NOT NULL,
	"atividade_id" text NOT NULL,
	"lida_em" timestamp with time zone NOT NULL,
	CONSTRAINT "notificacoes_lidas_usuario_id_atividade_id_pk" PRIMARY KEY("usuario_id","atividade_id")
);
--> statement-breakpoint
CREATE TABLE "preferencias_notificacao" (
	"usuario_id" text NOT NULL,
	"tipo" text NOT NULL,
	"no_app" boolean NOT NULL,
	"push" boolean NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL,
	CONSTRAINT "preferencias_notificacao_usuario_id_tipo_pk" PRIMARY KEY("usuario_id","tipo")
);
--> statement-breakpoint
ALTER TABLE "atividades" ADD COLUMN "registrado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Atividades antigas: registradas quando ocorreram, não na hora desta migration.
UPDATE "atividades" SET "registrado_em" = "ocorrido_em";--> statement-breakpoint
ALTER TABLE "inscricoes_push" ADD CONSTRAINT "inscricoes_push_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes_estado" ADD CONSTRAINT "notificacoes_estado_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes_lidas" ADD CONSTRAINT "notificacoes_lidas_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencias_notificacao" ADD CONSTRAINT "preferencias_notificacao_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inscricoes_push_usuario_id_index" ON "inscricoes_push" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "atividades_registrado_em_index" ON "atividades" USING btree ("registrado_em");--> statement-breakpoint
-- O sino começa limpo para quem já existe: o histórico não vira aviso atrasado.
INSERT INTO "notificacoes_estado" ("usuario_id", "lidas_ate") SELECT "id", now() FROM "user" ON CONFLICT DO NOTHING;

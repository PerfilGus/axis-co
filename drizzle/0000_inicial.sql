CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ajustes" (
	"id" text PRIMARY KEY NOT NULL,
	"pedido_id" text NOT NULL,
	"tipo" text NOT NULL,
	"valor_anterior" integer NOT NULL,
	"valor_solicitado" integer NOT NULL,
	"motivo" text NOT NULL,
	"solicitado_por" text NOT NULL,
	"solicitado_em" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"decidido_por" text,
	"decidido_em" timestamp with time zone,
	"observacao_decisao" text
);
--> statement-breakpoint
CREATE TABLE "aliquotas" (
	"competencia" text PRIMARY KEY NOT NULL,
	"aliquota_bps" integer NOT NULL,
	"lancada_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anexos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"mime" text NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"criado_por" text NOT NULL,
	"caminho_blob" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text
);
--> statement-breakpoint
CREATE TABLE "atividades" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text,
	"papel" text,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"ocorrido_em" timestamp with time zone NOT NULL,
	"titulo" text,
	"descricao" text,
	"antes" jsonb,
	"depois" jsonb,
	"dados" jsonb,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "bancos_plataformas" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"identificador" text NOT NULL,
	"saldo" integer DEFAULT 0 NOT NULL,
	"icone_url" text,
	"cor" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"fonte" text DEFAULT 'manual' NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL,
	"boleto" jsonb NOT NULL,
	"franquia_boleto" jsonb NOT NULL,
	"pix" jsonb NOT NULL,
	"cartao" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bonus_nivel" (
	"id" text PRIMARY KEY NOT NULL,
	"colaborador_id" text NOT NULL,
	"nivel_id" text NOT NULL,
	"valor" integer NOT NULL,
	"liberado_em" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"pago_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"cpf" text,
	"endereco" jsonb NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colaboradores" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"apelido" text NOT NULL,
	"email" text NOT NULL,
	"telefone" text DEFAULT '' NOT NULL,
	"perfil" text NOT NULL,
	"setor" text NOT NULL,
	"avatar_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"entrou_em" timestamp with time zone NOT NULL,
	"vendedores_atribuidos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nivel_id" text,
	"pontos" integer DEFAULT 0 NOT NULL,
	"salario_fixo" integer DEFAULT 0 NOT NULL,
	"dia_pagamento" integer DEFAULT 5 NOT NULL,
	"chave_pix" text,
	"comissao_bps" integer DEFAULT 0 NOT NULL,
	"frustrado_bps" integer
);
--> statement-breakpoint
CREATE TABLE "conquistas" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"icone" text NOT NULL,
	"pontos" integer NOT NULL,
	"gatilho" text NOT NULL,
	"repetivel" boolean DEFAULT false NOT NULL,
	"criterio" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conquistas_desbloqueadas" (
	"id" serial PRIMARY KEY NOT NULL,
	"conquista_id" text NOT NULL,
	"colaborador_id" text NOT NULL,
	"desbloqueada_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criativos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"codigo" text NOT NULL,
	"variacao" text,
	"formato" text NOT NULL,
	"linha_whatsapp_id" text NOT NULL,
	"anuncio_meta" text,
	"thumb_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "despesas_fixas" (
	"id" text PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"categoria" text NOT NULL,
	"valor" integer NOT NULL,
	"dia_vencimento" integer NOT NULL,
	"desde" text NOT NULL,
	"ate" text
);
--> statement-breakpoint
CREATE TABLE "dias_meta_ads" (
	"id" text PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"investimento" integer NOT NULL,
	"leads" integer NOT NULL,
	"fonte" text DEFAULT 'manual' NOT NULL,
	"lancado_em" timestamp with time zone NOT NULL,
	CONSTRAINT "dias_meta_ads_data_unique" UNIQUE("data")
);
--> statement-breakpoint
CREATE TABLE "dividas" (
	"id" text PRIMARY KEY NOT NULL,
	"credor" text NOT NULL,
	"descricao" text NOT NULL,
	"valor_original" integer NOT NULL,
	"juros_bps" integer NOT NULL,
	"parcelas" jsonb NOT NULL,
	"contratada_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faturas_fornecedor" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" text,
	"de" date NOT NULL,
	"ate" date NOT NULL,
	"valor_cobrado" integer NOT NULL,
	"observacoes" text,
	"lancada_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"itens" jsonb NOT NULL,
	"preco_tabela" integer NOT NULL,
	"preco_minimo" integer NOT NULL,
	"frete_estimado" integer NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancamentos_meta_ads" (
	"id" text PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"criativo_id" text NOT NULL,
	"campanha" text NOT NULL,
	"investimento" integer NOT NULL,
	"impressoes" integer NOT NULL,
	"cliques" integer NOT NULL,
	"conversas" integer NOT NULL,
	"fonte" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linhas_whatsapp" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"numero" text NOT NULL,
	"vendedores_ids" jsonb NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criada_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" text PRIMARY KEY NOT NULL,
	"colaborador_id" text NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"periodo" text NOT NULL,
	"faixas" jsonb NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niveis" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"ordem" integer NOT NULL,
	"pontos_necessarios" integer NOT NULL,
	"bonus" integer DEFAULT 0 NOT NULL,
	"icone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagamentos_colaborador" (
	"id" text PRIMARY KEY NOT NULL,
	"colaborador_id" text NOT NULL,
	"competencia" text NOT NULL,
	"fixo" integer NOT NULL,
	"comissao" integer NOT NULL,
	"bonus_meta" integer NOT NULL,
	"bonus_nivel" integer NOT NULL,
	"total" integer NOT NULL,
	"pagar_em" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"pago_em" timestamp with time zone,
	"detalhamento" jsonb NOT NULL,
	"bonus_nivel_ids" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagamentos_fornecedor" (
	"id" text PRIMARY KEY NOT NULL,
	"pago_em" timestamp with time zone NOT NULL,
	"valor" integer NOT NULL,
	"comprovante_anexo_id" text,
	"observacoes" text,
	"lancado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametros_fornecedor" (
	"id" text PRIMARY KEY NOT NULL,
	"fornecedor" text NOT NULL,
	"custo_pote" integer NOT NULL,
	"frete_envio" integer NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" serial NOT NULL,
	"status" text NOT NULL,
	"cliente_id" text NOT NULL,
	"itens" jsonb NOT NULL,
	"valor_total" integer NOT NULL,
	"frete" integer NOT NULL,
	"vendedor_id" text NOT NULL,
	"criativo_id" text,
	"linha_whatsapp_id" text,
	"agendado_para" timestamp with time zone,
	"criado_em" timestamp with time zone NOT NULL,
	"autorizado_em" timestamp with time zone,
	"autorizado_por" text,
	"rastreio" jsonb,
	"cobranca" jsonb NOT NULL,
	"custos" jsonb NOT NULL,
	"confirmacao_por_texto" boolean DEFAULT false NOT NULL,
	"endereco_validado" boolean DEFAULT false NOT NULL,
	"motivo_cancelamento" text,
	"observacoes" text,
	"fonte" text DEFAULT 'manual' NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL,
	CONSTRAINT "pedidos_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"sabor" text,
	"gramas" integer NOT NULL,
	"custo_unitario" integer NOT NULL,
	"foto_url" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	"trocar_senha" boolean DEFAULT true NOT NULL,
	"termo_aceito_em" timestamp with time zone,
	"termo_versao" text,
	"falhas_login" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_nivel" ADD CONSTRAINT "bonus_nivel_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_nivel" ADD CONSTRAINT "bonus_nivel_nivel_id_niveis_id_fk" FOREIGN KEY ("nivel_id") REFERENCES "public"."niveis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquistas_desbloqueadas" ADD CONSTRAINT "conquistas_desbloqueadas_conquista_id_conquistas_id_fk" FOREIGN KEY ("conquista_id") REFERENCES "public"."conquistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conquistas_desbloqueadas" ADD CONSTRAINT "conquistas_desbloqueadas_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criativos" ADD CONSTRAINT "criativos_linha_whatsapp_id_linhas_whatsapp_id_fk" FOREIGN KEY ("linha_whatsapp_id") REFERENCES "public"."linhas_whatsapp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metas" ADD CONSTRAINT "metas_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos_colaborador" ADD CONSTRAINT "pagamentos_colaborador_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedor_id_colaboradores_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."colaboradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_index" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ajustes_pedido_id_index" ON "ajustes" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "anexos_entidade_entidade_id_index" ON "anexos" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "atividades_entidade_entidade_id_ocorrido_em_index" ON "atividades" USING btree ("entidade","entidade_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "atividades_usuario_id_ocorrido_em_index" ON "atividades" USING btree ("usuario_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "atividades_ocorrido_em_index" ON "atividades" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE INDEX "clientes_cpf_index" ON "clientes" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "clientes_telefone_index" ON "clientes" USING btree ("telefone");--> statement-breakpoint
CREATE INDEX "conquistas_desbloqueadas_colaborador_id_index" ON "conquistas_desbloqueadas" USING btree ("colaborador_id");--> statement-breakpoint
CREATE INDEX "lancamentos_meta_ads_data_index" ON "lancamentos_meta_ads" USING btree ("data");--> statement-breakpoint
CREATE UNIQUE INDEX "pagamentos_colaborador_colaborador_id_competencia_index" ON "pagamentos_colaborador" USING btree ("colaborador_id","competencia");--> statement-breakpoint
CREATE INDEX "pedidos_vendedor_id_index" ON "pedidos" USING btree ("vendedor_id");--> statement-breakpoint
CREATE INDEX "pedidos_status_index" ON "pedidos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pedidos_criado_em_index" ON "pedidos" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "session_user_id_index" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_index" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_index" ON "two_factor" USING btree ("secret");
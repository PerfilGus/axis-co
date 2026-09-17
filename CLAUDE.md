# Axis — sistema de gestão

Front-end de um sistema de gestão para venda D2C de suplementos no modelo PAD
(pagamento na entrega). Funil: Meta Ads → WhatsApp → fechamento por telefone →
envio pelos Correios → cobrança após a entrega.

## Contexto do projeto

- Sistema interno de gestão da Axis (venda D2C de suplementos): pedidos,
  rastreios, cobrança, fornecedores, marketing, metas e bônus.
- Stack: Next.js + TypeScript + Tailwind + shadcn/ui, Neon (Postgres) + Drizzle,
  deploy na Vercel.
- Usuários: administrador (dono), vendedores e cobradores. Uso intenso no
  celular (iPhone, app instalado na tela de início como PWA).
- Identidade visual: fonte Space Grotesk, fundo #121212, destaque amarelo
  #FFBE00, textos #EAEAEA e #A9A9A7.
- Integrações de logística (Correios/VendLiber) ficam para depois. Não
  implementar agora.
- Existe outro projeto na Vercel (axis-tracking) que não pode ser alterado.

## Regras de trabalho

1. Ao iniciar uma fase: ler o código relevante, apresentar um plano curto e
   esperar minha aprovação.
2. Mudanças pequenas e verificáveis. Não alterar visual nem regra de negócio
   fora do escopo da fase sem perguntar.
3. Ao terminar uma fase: build, lint e typecheck sem erros; checklist de testes
   manuais (desktop e iPhone); commit descritivo. Depois, parar.
4. Confirmar comigo antes de ações irreversíveis: push, deploy em produção,
   migrations no banco de produção, exclusão de dados.
5. Nunca commitar segredos. Toda variável nova vai para .env.example (sem valor)
   e você me avisa para cadastrar na Vercel.
6. Datas e horas sempre em America/Sao_Paulo. Valores em BRL.
7. Um único componente reutilizável por padrão (filtro de período, tabela,
   painel lateral, diálogo de confirmação, busca). Nada duplicado.
8. Todo evento relevante (login, criação, edição, mudança de status, pagamento,
   frustração, agendamento, solicitação de alteração, aprovação/recusa,
   arquivamento, exclusão) grava numa tabela única de atividades com: usuário
   responsável, papel, ação, entidade, data/hora e valores antes/depois quando
   aplicável. Essa tabela alimenta a linha do tempo, as notificações e a
   auditoria da LGPD.
9. Mobile não é adaptação posterior: todo componente novo ou alterado precisa
   funcionar em tela de iPhone.
10. Responder em português, usando "você".

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · componentes no estilo
shadcn/ui, reestilizados · Phosphor Icons (peso `fill`, variante `/ssr`).
Neon Postgres (região gru1) via Drizzle · Better Auth (argon2id, TOTP, plugin
admin) · Vercel Blob privado · Zod nas ações. Projeto Vercel: `axis-sistema`
(time axis-company1), separado do axis-tracking.

## Estado atual

Protótipo (fases 1 a 5 do front) concluído. Fase de backend 1 — banco real,
login e LGPD — concluída: tudo lê e grava no Neon, não existe mock nem dado
fictício, e o único seed é o administrador inicial (`npm run db:seed`).
Fase 6 — metas, pontos e bônus configuráveis — concluída: nada de pontuação
mora no código, tudo vem das telas de Configurações › Pontos e metas. A
contagem começa do zero na vigência da primeira regra; o passado não é
recalculado.

Integrações ainda não reais: Correios/VendLiber (o código de rastreio fica
vazio após autorizar; "Atualizar rastreios" responde sem novidade) e API do
Meta Ads (`lancamentos` chega vazio; só o lançamento manual por dia existe).
O CEP é real (ViaCEP, via servidor).

Preview, produção e desenvolvimento usam hoje o mesmo banco Neon e o mesmo
store do Blob. Separar antes de ir para produção.

## Mapa do código

- `src/lib/types/` — contratos do domínio. `rastreio.ts` é o contrato de `order`
  do axis-tracking, com o mapa de nomes no topo do arquivo.
- `src/lib/rastreio/` — a aba Rastreio, migrada do axis-tracking: lista,
  busca e agrupamento, cópia inteligente, CSV, mapa evento SRO → status e a
  atualização simulada. Rastreio apagado (`rastreioRemovidoEm`) some da aba e
  de toda sincronização; o pedido fica intacto. Arquivados não expiram. O levantamento do que foi portado, ajustado ou removido está em
  `referencia/axis-tracking/INVENTARIO.md` — consulte antes de mexer nessa aba.
- `src/lib/servidor/` — só servidor (`server-only`). `schema.ts` (Drizzle, chaves
  camelCase gravadas em snake_case; `timestamptz` trafega como ISO -03:00),
  `db.ts` (Pool do Neon, com transação), `auth.ts` (Better Auth: sessão sem
  expiração por inatividade, bloqueio de 5 falhas por 15 min, auditoria de
  login), `sessao.ts` (`contextoDaSessao`, pendências de primeiro acesso,
  `exigirUsuario`/`exigir`/`executar`), `dados.ts` (o que cada perfil recebe ao
  abrir o sistema, já recortado e mascarado), `atividades.ts` (tabela única de
  atividades), `arquivos.ts` (Blob privado) e `repositorio/pedidos.ts` (o
  agregado pedido e a linha do tempo, que é a própria tabela de atividades).
- `src/app/acoes/` — server actions. Toda ação: `executar` → `exigirUsuario` →
  `exigir(permissão)` → Zod → transação que grava o dado **e** a atividade →
  devolve o estado novo. `validacao.ts` guarda os schemas comuns.
- `src/lib/dominio/` — regras puras de mudança (pedidos, trilha de níveis). O
  servidor executa sobre o que leu do banco; a tela nunca decide estado final.
- `src/lib/permissoes.ts` — matriz de permissões, fonte única para proxy,
  ações, rotas de API e interface.
- `src/proxy.ts` — CSP com nonce e headers de segurança; sessão e perfil por rota.
- `src/app/api/anexos/[id]` — única leitura de arquivo: confere sessão e
  permissão, registra visualização de anexo de pedido, responde sem cache.
  Arquivo apagado pela retenção responde 410.
- `src/lib/servidor/pontos.ts` — pontos no banco. `gravarPedido` chama
  `sincronizarPontosDoPedido` na mesma transação da mudança de status: o extrato
  (`lancamentos_pontos`) só recebe inserções, corrigir um status reverte sozinho
  e rodar duas vezes não duplica. Depois recalcula o saldo de
  `colaboradores.pontos` e reavalia o nível (sobe, cai e libera bônus).
  `avaliarJanelasFechadas` fecha as janelas de conquista e recompensa.
- `src/app/api/cron/pontos` — rotina diária (00:10 de São Paulo) que fecha as
  janelas. Idempotente: o índice único por janela impede pontuar duas vezes. O
  Admin também dispara pelo botão "Conferir agora".
- `src/app/api/cron/retencao` — rotina diária do Vercel Cron (`vercel.json`),
  sem sessão, protegida por `CRON_SECRET`. Apaga do Blob os arquivos de pedido
  vencidos, marca `anexos.removido_em` e grava uma atividade por arquivo.
- `src/lib/retencao.ts` — prazo dos arquivos de pedido: 60 dias da criação ou
  7 dias após Pago/Cancelado/Reembolsado, o que vier primeiro. `finalizadoEm` é
  carimbado por `gravarPedido` e zera se o status sai da lista.
- `drizzle/` — migrations versionadas (`npm run db:gerar`, `npm run db:migrar`).
- `src/lib/nav.ts` — mapa de navegação e permissões por perfil.
- `src/components/config/editor-pontuacao.tsx` — regra de pontuação por setor e
  o simulador ao lado. Salvar cria uma versão com data de vigência; versões
  antigas ficam, porque os lançamentos apontam para elas.
- `src/components/shared/extrato-pontos.tsx` — o extrato, igual na Minha área e
  na gaveta do Admin. A sessão traz o mês passado e este; período mais longo vai
  ao servidor por `extratoDePontos`.
- `src/lib/status.ts` — rótulos e tons de status. **As cores de status são
  fixas**: nunca acompanham o destaque escolhido pelo usuário. As de rastreio
  são os valores exatos do axis-tracking, nas variáveis `--rt-*`.
- `src/lib/providers/` — estado da interface. Nascem com o que
  `(app)/layout.tsx` carregou do banco (`ProvedoresDados`) e cada mutação é
  assíncrona: chama a server action por `chamar` (que mostra o erro e devolve
  `null`) e troca o estado pelo que o servidor devolveu. Telas conferem o
  retorno antes de mostrar sucesso. `sessao.tsx` expõe o usuário logado e os
  atalhos de `lib/permissoes.ts`. `financeiro.tsx` e `marketing.tsx` guardam só
  o que é lançado: previsto, DRE e análises são recalculados.
  Ordem de montagem: Equipe > Sessão > Cadastros > Pedidos > Financeiro > Marketing > Notificações.
- `src/lib/filas.ts` — filas de autorização e cobrança. O contador da subaba e
  a lista que ela abre saem daqui, para nunca divergirem.
- `src/lib/checklist.ts` — a conferência que libera um envio. A ação de
  autorizar reusa a mesma função, então não há caminho que fure a checagem.
- `src/lib/taxas.ts` — taxa por forma de recebimento a partir do cadastro do
  banco, com a franquia de boletos (`boletosNoPeriodo`).
- `src/lib/periodos.ts` — janelas de meta, ranking e competência, cortadas no
  fuso de São Paulo por aritmética (nunca `setHours`: diverge na hidratação).
  Períodos de análise trafegam como dois dias `aaaa-mm-dd`, inclusive.
- `src/lib/desempenho.ts` — o que cada colaborador fez num intervalo: agendados,
  enviados, pagos, frustração. Metas, ranking e comissões contam daqui.
- `src/lib/metricas.ts` — catálogo do que metas, conquistas e recompensas podem
  medir (agendados, pagos, valor recebido, taxas, pontos, dias trabalhados). Cada
  métrica tem unidade e sentido (`maior_igual` ou `menor_igual`); a medição sai
  de `desempenho.ts` e do extrato.
- `src/lib/metas.ts` — meta é métrica + alvo + janela, para um setor ou uma
  pessoa, dentro da vigência. Não há faixas: dinheiro é recompensa.
- `src/lib/pontos.ts` — motor de pontos, puro. `pontosDoPedido` (fixo, faixa de
  valor ou kit), `lancamentosDevidos` (a diferença entre o extrato e o que o
  status atual deveria render), `nivelComQueda` (queda só abaixo da tolerância)
  e `simular` (o simulador da tela usa as mesmas funções).
- `src/lib/recompensas.ts` — conquistas e recompensas de uma janela: o que já
  foi registrado, o que falta e o progresso da janela corrente.
- `src/lib/ranking.ts` — classificação da equipe. Ranking e o card Equipe da
  Minha área leem daqui.
- `src/lib/minha-area.ts` — semana e sequência de dias.
  Dia trabalhado é dia com algum evento de autoria do colaborador na linha do
  tempo de um pedido (`diasComAtividade`, em `desempenho.ts`).
- `src/lib/comissoes.ts` — fórmula de vendedor e cobrador e o fechamento com
  detalhamento. Pendente é recalculado; pago congela no provider. O grupo
  `bonus_meta` são as recompensas liberadas cuja janela terminou na competência.
- `src/lib/fornecedor.ts` — custo previsto por envio (frete + potes; reembolsado
  só frete; cancelado fora), reembolsados para abatimento e conferência de fatura.
  O envio conta na data da autorização.
- `src/lib/meta-ads.ts` — dias de Meta Ads (API ou manual, nunca os dois no mesmo
  dia) e análise por criativo. Venda é pedido agendado no dia, sem cancelados. O
  investimento manual, sem detalhe por criativo, cai em "Criativo não identificado".
- `src/lib/resultado.ts` — DRE em caixa e competência, alíquota do Simples
  (sem valor confirmado, herda a do mês anterior como estimada) e previsão de
  entrada em 30 dias. Comissões vêm de `fechamentosDaCompetencia`, o mesmo da
  tela de comissões.
- `src/lib/cep.ts` — busca de endereço pelo ViaCEP (ação `acoes/cep.ts`).
- `src/lib/imagem.ts` — compressão no navegador (WebP, até 1600px; JPEG onde o
  Safari não gera WebP). `EnvioArquivo` e `EnvioImagem` já comprimem.
- `src/lib/senha.ts` — política de senha (tela e servidor) e senha provisória.
- `src/components/acesso/` e `(acesso)/` — login, primeiro acesso (troca de
  senha → termo → 2FA para admin) e política de privacidade.
- `src/components/lgpd/textos.tsx` — termo e política, RASCUNHO para revisão
  jurídica. Mudar o termo exige subir `VERSAO_TERMO` em `lib/servidor/sessao.ts`.
- `src/components/ui/` — primitivos reestilizados.
- `src/components/shared/` — componentes de produto reutilizáveis. Busca é
  sempre `CampoBusca` (com debounce), inclusive dentro da `Tabela`.
- `src/lib/tela.ts` — `useTelaLarga`, para trocar coluna fixa por gaveta.
- `src/lib/url.ts` — `useParametroUrl`: estado na query (`?pedido=`, `?secao=`,
  `?notificacoes=1`) trocado pela History API. É como busca, sino e push levam
  direto ao item.
- `src/lib/busca.ts` — busca global pura (pedidos, clientes, rastreios,
  fornecedor) sobre os dados da sessão, no escopo do perfil. Telefone e CPF
  completos vão ao servidor (`buscarPedidosPorDocumento`), que devolve só ids.
  Tela: `components/busca/busca-global.tsx` (Cmd/Ctrl+K, tela cheia no celular).
- `src/lib/notificacoes.ts` — catálogo de tipos. Notificação não tem tabela: é
  a atividade lida por `tipoDaAtividade`, recortada por `alcanca` (ninguém é
  avisado do que fez) e pela preferência do usuário. Evento novo que deva avisar
  entra no catálogo e em `ACOES_NOTIFICAVEIS`. Integração dos Correios: gravar
  atividade `rastreio` com `dados.rastreioStatus` (só fase final avisa).
- `src/lib/servidor/notificacoes.ts` — lista do sino (60 dias, 100 itens), lida
  por `registradoEm` (gravação), não por `ocorridoEm`. Polling em
  `GET /api/notificacoes` a cada 60 s só com a aba visível.
- `src/lib/servidor/push.ts` — Web Push (VAPID). `registrarAtividades` agenda o
  envio com `after`; atividade de transação desfeita não é achada e não envia.
  Mais de 3 avisos numa leva viram um resumo. Texto sem dado de cliente.
- `public/sw.js`, `app/manifest.ts`, `app/icones/[tamanho]` — app instalável e
  service worker (só push, sem cache de página).

## Convenções

- Dinheiro trafega em **centavos** (`Centavos`), formatado com `formatBRL`.
  Em tabelas, alinhado à direita com a classe `tabular`.
- Datas em `dd/mm/aaaa` via `formatData`. ISO sempre com fuso `-03:00`.
- Textos em português, em caixa normal. Botões com verbo claro.
- Nomes de domínio em português; hooks do React mantêm o prefixo `use`
  (`usePreferencia`), exigência da regra `react-hooks/rules-of-hooks`.
- Raio: pílulas > cards (24px) > inputs (14px). Sem sombra no tema escuro.
- Gráficos saem de `components/shared/grafico.tsx`: uma série e um eixo por
  gráfico. Duas medidas de escala diferente viram dois gráficos alinhados.
- `Tabela` desenha 50 linhas e oferece mostrar mais; `rodape` soma as visíveis.
- Movimento só em resposta a ações. A exceção é a premiação (`axis-premio`).
- Funções passadas a `setState` são puras: em desenvolvimento o React as chama
  duas vezes. Ações em lote calculam o resultado antes de chamar `setPedidos`.
- Depois de muitas edições seguidas, o Turbopack pode servir chunk velho e
  acusar erro inexistente. `rm -rf .next` e suba o servidor de novo antes de
  investigar.
- Pontos: o vendedor ganha ao agendar; cancelado antes da autorização estorna
  tudo (o pedido vale zero); frustrado (reembolsado ou inadimplente) tira a
  porcentagem configurada. O cobrador ganha quando o pedido é pago e, no
  frustrado, perde a mesma porcentagem do que o pedido valeria pago. Corrigir o
  status reverte sozinho, com a data da correção — nada é recalculado para trás.
- LGPD: CPF e telefone sempre mascarados em listas (`mascararPedido`); o dado
  completo só por `revelarDados`, que registra a visualização. Campo livre sobre
  cliente leva `AvisoSaude`. Arquivo nunca tem URL pública: sempre
  `/api/anexos/[id]`.
- Toda variável nova vai para `.env.example`. O seed usa `ADMIN_INICIAL_*`, que
  não precisam existir na Vercel.
- Mudou o schema: `npm run db:gerar` e revise o SQL antes de `db:migrar`. Em
  banco de produção, só com confirmação.

## Antes de entregar

```bash
npm run typecheck && npm run lint && npm run build
```

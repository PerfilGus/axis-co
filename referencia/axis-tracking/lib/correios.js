// Proxy da API dos Correios (Rastro). As credenciais ficam só em variáveis de
// ambiente da Vercel — nunca no repositório nem no frontend.
//
// Sem credenciais configuradas, getTracking() devolve { degraded: true } e o
// app segue funcionando (só sem eventos reais de rastreio).

const ENV = (process.env.CORREIOS_ENV || 'HOMOLOGACAO').toUpperCase();
const BASE = ENV === 'PRODUCAO' ? 'https://api.correios.com.br' : 'https://apihom.correios.com.br';

const USER = process.env.CORREIOS_USER;
const ACCESS_CODE = process.env.CORREIOS_ACCESS_CODE;
const CARTAO = process.env.CORREIOS_CARTAO_POSTAGEM;

export function correiosConfigured() {
  return Boolean(USER && ACCESS_CODE && CARTAO);
}

// Token Bearer é caro de gerar e válido por ~24h — cacheia em memória do processo.
let tokenCache = { value: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;

  const basic = Buffer.from(`${USER}:${ACCESS_CODE}`).toString('base64');
  const res = await fetch(`${BASE}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ numero: CARTAO }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha ao gerar token Correios (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  // `expiraEm` vem sem fuso ("2026-09-13T07:18:04") e o offset real chega
  // separado em `zoneOffset`. Sem colar os dois, o Node (UTC na Vercel) leria
  // o horario de Brasilia como UTC e derrubaria o cache 3h antes da hora.
  const expiraEm = data.expiraEm ? new Date(data.expiraEm + (data.zoneOffset || '')).getTime() : NaN;
  tokenCache = {
    value: data.token,
    expiresAt: Number.isFinite(expiraEm) ? expiraEm : Date.now() + 12 * 3600_000,
  };
  return tokenCache.value;
}

// A API entrega `dtHrCriado` em horário de Brasília SEM o offset
// ("2026-09-11T22:22:58"). O Node (UTC na Vercel) leria isso como UTC e todo
// "há X" sairia 3h errado — por isso o offset é colado quando falta.
const EVENT_TZ = '-03:00';

function eventIso(dtHrCriado) {
  if (!dtHrCriado) return new Date().toISOString();
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(dtHrCriado);
  const d = new Date(temFuso ? dtHrCriado : dtHrCriado + EVENT_TZ);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Evento SRO (código + tipo + descrição) -> chave de status do Axis.
// Calibrado contra os eventos reais do contrato: FC/82, FC/03, PO/01, PO/09,
// DO/01 e RO/01. O resto vem dos exemplos do manual e dos códigos SRO comuns.
function mapEventType(ev) {
  const codigo = String(ev.codigo || '').toUpperCase();
  const tipo = String(ev.tipo || '');
  const desc = String(ev.descricao || '').toLowerCase();

  // FC significa coisas opostas conforme o tipo: 82 é "Etiqueta emitida" (o
  // objeto nem saiu do remetente) e 03 é correção de rota (já viajando).
  // Sem esse caso, a etiqueta recém-emitida caía no default e virava
  // "em transferência".
  if (codigo === 'FC') return tipo === '82' ? 'aguardando_postagem' : 'em_transferencia';

  // "Objeto não entregue - cliente desconhecido no local" CONTÉM "entregue".
  // A negação tem que ser checada antes de qualquer teste de entrega — sem isso
  // um insucesso real aparecia como "Entregue" e sumia da seção de falhas.
  if (desc.includes('não entregue') || desc.includes('nao entregue')) return 'falha';

  // BDE/BDI/BDR são a baixa de entrega: tipo 01 deu certo, o resto é insucesso.
  if (codigo === 'BDE' || codigo === 'BDI' || codigo === 'BDR') {
    return tipo === '01' || desc.includes('entregue') ? 'entregue' : 'falha';
  }
  if (codigo === 'OEC' || desc.includes('rota de entrega') || desc.includes('saiu para entrega')) {
    return 'saiu_para_entrega';
  }
  if (codigo === 'LDI' || desc.includes('aguardando retirada') || desc.includes('disponível para retirada')) {
    return 'aguardando_retirada';
  }
  if (codigo === 'PO' || codigo === 'PA' || desc.includes('postado')) return 'postado';
  if (codigo === 'RO' || codigo === 'DO' || codigo === 'RC'
      || desc.includes('transferência') || desc.includes('encaminhado')) {
    return 'em_transferencia';
  }
  // "endereço" sozinho era amplo demais aqui — casava com a retirada em agência.
  if (desc.includes('não efetuada') || desc.includes('tentativa de entrega')
      || desc.includes('recusado') || desc.includes('ausente')
      || desc.includes('endereço incorreto') || desc.includes('endereço insuficiente')
      || desc.includes('extraviado') || desc.includes('avariado')) {
    return 'falha';
  }
  return 'em_transferencia';
}

function toAxisEvent(ev) {
  const un = ev.unidade || {};
  const end = un.endereco || {};
  const city = [end.cidade, end.uf].filter(Boolean).join('/');
  return {
    at: eventIso(ev.dtHrCriado),
    title: ev.descricao || 'Evento de rastreio',
    desc: (ev.detalhe || '').replace(/\r?\n/g, ' ').trim(),
    city: city || '—',
    type: mapEventType(ev),
  };
}

// O motivo do insucesso vem no próprio título ("Objeto não entregue - endereço
// insuficiente"); o `detalhe` costuma ser a consequência ("Objeto será devolvido
// ao remetente"), não o porquê.
function failureReasonOf(ev) {
  const i = ev.title.indexOf(' - ');
  if (i === -1) return ev.desc || ev.title;
  const motivo = ev.title.slice(i + 3).trim();
  return motivo ? motivo.charAt(0).toUpperCase() + motivo.slice(1) : (ev.desc || ev.title);
}

// O SRO manda tudo em caixa alta ("RUA GEDEON ALVES FEITOSA"); a cópia vai
// para o WhatsApp do cliente, então vale deixar legível.
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
function titleCase(s) {
  return String(s || '').toLowerCase().split(/\s+/).filter(Boolean)
    .map((w, i) => (i && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// A agência vem no próprio evento de retirada (LDI): `unidade.endereco` é o
// endereço e `dtLimiteRetirada` o prazo. Sem gravar isto o painel e a cópia
// ficavam sem ter onde mandar o cliente buscar o pedido.
function pickupOf(ev) {
  const un = ev.unidade || {};
  const e = un.endereco || {};
  const cep = String(e.cep || '').replace(/\D/g, '');
  const address = [
    [titleCase(e.logradouro), e.numero].filter(Boolean).join(', '),
    titleCase(e.complemento),
    titleCase(e.bairro),
    [titleCase(e.cidade), e.uf].filter(Boolean).join('/'),
    cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : '',
  ].filter(Boolean).join(' - ');
  return {
    agency: un.nome ? titleCase(un.nome) : (un.tipo || 'Agência dos Correios'),
    address: address || 'Endereço não informado pelos Correios',
    availableAt: eventIso(ev.dtHrCriado),
    // só a data ("2026-09-21"): vale até o fim do dia, no horário de Brasília
    deadline: ev.dtLimiteRetirada ? eventIso(`${ev.dtLimiteRetirada}T23:59:59`) : null,
  };
}

// Um objeto da resposta SRO -> o pedaço de pedido que o Axis atualiza.
function parseObjeto(obj) {
  if (!obj || obj.mensagem || !Array.isArray(obj.eventos) || !obj.eventos.length) {
    return { found: false, events: [] };
  }
  // o evento cru acompanha o convertido porque a agência de retirada só existe nele
  const pares = obj.eventos
    .map((raw) => ({ raw, ev: toAxisEvent(raw) }))
    .sort((a, b) => new Date(b.ev.at) - new Date(a.ev.at)); // mais recente primeiro
  const events = pares.map((p) => p.ev);

  const status = events[0].type;
  return {
    found: true,
    status,
    failureReason: status === 'falha' ? failureReasonOf(events[0]) : null,
    pickup: status === 'aguardando_retirada' ? pickupOf(pares[0].raw) : null,
    events,
    dtPrevista: obj.dtPrevista || null,
  };
}

const SRO_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  // O fetch do Node manda `Accept-Language: *`, que o SRO rejeita (SRO-018).
  'Accept-Language': 'pt-BR',
});

const DEGRADED = {
  degraded: true,
  message: 'Credenciais dos Correios não configuradas. Rastreio em modo degradado.',
  events: [],
};

/**
 * Consulta o rastreio de um código.
 * @returns {{ degraded?: boolean, message?: string, found?: boolean,
 *             status?: string, failureReason?: string|null, events?: object[] }}
 */
export async function getTracking(code) {
  if (!correiosConfigured()) return { ...DEGRADED };

  const token = await getToken();
  const res = await fetch(`${BASE}/srorastro/v1/objetos/${encodeURIComponent(code)}?resultado=T`, {
    headers: SRO_HEADERS(token),
  });

  if (res.status === 404) return { found: false, events: [] };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha na consulta de rastro (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return parseObjeto(data?.objetos?.[0]);
}

// O SRO aceita vários códigos por chamada. Atualizar 19 pedidos um a um seriam
// 19 requisições por ciclo; em lote é uma só — o que torna viável o ciclo
// automático de 1 minuto sem martelar a API dos Correios.
const BATCH_SIZE = 50;

/**
 * Consulta vários códigos de uma vez.
 * @returns {Promise<Map<string, object>>} código -> mesmo formato de getTracking
 */
export async function getTrackingBatch(codes) {
  const out = new Map();
  if (!correiosConfigured() || !codes.length) return out;

  const token = await getToken();
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const lote = codes.slice(i, i + BATCH_SIZE);
    const url = `${BASE}/srorastro/v1/objetos?codigosObjetos=${lote.join(',')}&resultado=T`;
    const res = await fetch(url, { headers: SRO_HEADERS(token) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Falha na consulta de rastro em lote (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    for (const obj of data?.objetos || []) {
      if (obj?.codObjeto) out.set(obj.codObjeto.toUpperCase(), parseObjeto(obj));
    }
  }
  return out;
}

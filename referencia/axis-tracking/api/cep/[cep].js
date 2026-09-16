// Consulta de endereço por CEP.
//   GET /api/cep/01001000  ->  { cep, street, district, city, uf }
//
// Usa o ViaCEP (público, sem credencial). Quando o contrato dos Correios estiver
// ativo, dá para trocar pela API CEP dos Correios aqui dentro sem mexer no frontend.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'método não permitido' });
  }

  const cep = String(req.query.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) return res.status(400).json({ error: 'CEP deve ter 8 dígitos' });

  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(502).json({ error: 'falha ao consultar o CEP' });
    const d = await r.json();
    if (d.erro) return res.status(404).json({ error: 'CEP não encontrado' });

    return res.status(200).json({
      cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
      street: d.logradouro || '',
      district: d.bairro || '',
      city: d.localidade || '',
      uf: (d.uf || '').toUpperCase(),
    });
  } catch (err) {
    console.error('[api/cep]', err);
    return res.status(502).json({ error: 'falha ao consultar o CEP' });
  }
}

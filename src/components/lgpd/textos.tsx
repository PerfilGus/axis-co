/**
 * Textos jurídicos — RASCUNHO para revisão com advogado.
 *
 * Não têm valor legal enquanto não forem revisados. Mudar o termo exige subir
 * `VERSAO_TERMO` em `lib/servidor/sessao.ts`, para todos aceitarem de novo.
 * Os trechos entre colchetes precisam ser preenchidos.
 */

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-medium text-fg">{titulo}</h2>
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted-fg">{children}</div>
    </section>
  );
}

export function AvisoRascunho() {
  return (
    <p className="rounded-[var(--radius-card-sm)] border border-[var(--st-bronze-bg)] bg-[var(--st-bronze-bg)] px-4 py-3 text-[13px] text-[var(--st-bronze-fg)]">
      Rascunho em revisão jurídica. O texto final pode mudar.
    </p>
  );
}

export function TermoConfidencialidade() {
  return (
    <div className="flex flex-col gap-5">
      <Secao titulo="1. Objeto">
        <p>
          Este termo trata do sigilo sobre as informações a que você tem acesso no sistema de gestão da
          [RAZÃO SOCIAL], inscrita no CNPJ [CNPJ] (“Axis”), em razão da sua função.
        </p>
      </Secao>
      <Secao titulo="2. Informações confidenciais">
        <p>
          São confidenciais os dados pessoais de clientes (nome, telefone, CPF, endereço, histórico de
          pedidos e de pagamento), os dados de colaboradores, valores, metas, comissões, fornecedores,
          campanhas e qualquer informação do negócio vista no sistema.
        </p>
      </Secao>
      <Secao titulo="3. Seus compromissos">
        <p>Ao aceitar, você se compromete a:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>usar os dados só para executar o seu trabalho na Axis;</li>
          <li>não copiar, fotografar, exportar ou repassar dados de clientes por nenhum meio fora do sistema;</li>
          <li>não compartilhar a sua senha nem deixar a sessão aberta em aparelho de outra pessoa;</li>
          <li>
            não registrar informações de saúde do cliente (doenças, medicamentos, condições) em observações
            ou anexos;
          </li>
          <li>avisar o administrador imediatamente se perceber acesso indevido ou vazamento.</li>
        </ul>
      </Secao>
      <Secao titulo="4. Registro de acesso">
        <p>
          O sistema registra quem abriu os dados completos de cada cliente, quais anexos foram vistos e
          as alterações feitas, com data e hora. Esse registro serve à segurança e ao cumprimento da Lei
          Geral de Proteção de Dados (Lei 13.709/2018).
        </p>
      </Secao>
      <Secao titulo="5. Vigência e consequências">
        <p>
          O sigilo vale durante o vínculo com a Axis e por [PRAZO] após o seu término. O descumprimento
          pode gerar medidas disciplinares e responsabilização civil e criminal, nos termos da lei e do
          seu contrato.
        </p>
      </Secao>
    </div>
  );
}

export function PoliticaPrivacidade() {
  return (
    <div className="flex flex-col gap-5">
      <Secao titulo="1. Quem somos">
        <p>
          [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO], é a controladora dos dados tratados neste
          sistema. Encarregado (DPO): [NOME], [E-MAIL DE CONTATO].
        </p>
      </Secao>
      <Secao titulo="2. Que dados tratamos">
        <p>
          <strong className="text-fg">Clientes:</strong> nome, telefone, CPF (opcional), endereço de
          entrega, pedidos, prints e áudios de confirmação da compra, dados de pagamento e de rastreio.
        </p>
        <p>
          <strong className="text-fg">Colaboradores:</strong> nome, e-mail, telefone, foto, dados de
          remuneração e registros de acesso ao sistema (data, hora, IP e navegador no login).
        </p>
        <p>Não coletamos dados de saúde. A equipe é orientada a não registrá-los.</p>
      </Secao>
      <Secao titulo="3. Para que usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>fechar, enviar, entregar e cobrar os pedidos (execução de contrato);</li>
          <li>comprovar a confirmação da compra (exercício regular de direitos);</li>
          <li>emitir cobranças e cumprir obrigações fiscais (obrigação legal);</li>
          <li>calcular metas e comissões da equipe (execução do contrato de trabalho);</li>
          <li>proteger o sistema contra acesso indevido (legítimo interesse).</li>
        </ul>
      </Secao>
      <Secao titulo="4. Com quem compartilhamos">
        <p>
          Com os operadores necessários à operação: transportadora e Correios (entrega), bancos e
          plataformas de pagamento (cobrança), provedores de hospedagem e banco de dados (Vercel e Neon)
          e armazenamento de arquivos (Vercel Blob). Não vendemos dados.
        </p>
      </Secao>
      <Secao titulo="5. Segurança">
        <p>
          Acesso só com login individual, senha forte e verificação em duas etapas para administradores;
          CPF e telefone mascarados nas listas; arquivos em armazenamento privado, abertos só por quem
          está logado; registro de quem acessou o quê; conexão sempre criptografada.
        </p>
      </Secao>
      <Secao titulo="6. Por quanto tempo guardamos">
        <p>
          Pelo tempo necessário às finalidades acima e aos prazos legais (por exemplo, fiscais e de
          defesa em processos): [PRAZOS A DEFINIR]. Depois, os dados são excluídos ou anonimizados.
        </p>
      </Secao>
      <Secao titulo="7. Seus direitos">
        <p>
          Você pode pedir confirmação do tratamento, acesso, correção, anonimização ou exclusão,
          portabilidade e informações sobre compartilhamento, pelo contato [E-MAIL DO ENCARREGADO].
          Também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>
      <Secao titulo="8. Atualizações">
        <p>Esta política pode mudar. A data da última versão fica no topo da página.</p>
      </Secao>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  preferenciaDe,
  ROTULO_CATEGORIA,
  tiposDoPerfil,
  type CategoriaNotificacao,
  type DefinicaoNotificacao,
  type PreferenciaNotificacao,
} from "@/lib/notificacoes";
import { useSessao } from "@/lib/providers/sessao";
import { useNotificacoes } from "@/lib/providers/notificacoes";
import { estiloDoTom } from "@/lib/status";
import { Icone } from "@/components/icone";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Interruptor } from "@/components/ui/switch";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AtivarPush } from "@/components/notificacoes/ativar-push";

/**
 * Preferências de notificação. Cada pessoa escolhe as suas, entre os tipos que
 * o perfil dela pode receber — vendedor e cobrador só enxergam o que é deles.
 */
export default function PaginaNotificacoes() {
  const { perfil } = useSessao();
  const { preferencias, salvarPreferencia } = useNotificacoes();
  const [salvando, setSalvando] = useState<string | null>(null);

  const porCategoria = new Map<CategoriaNotificacao, DefinicaoNotificacao[]>();
  for (const def of tiposDoPerfil(perfil)) {
    porCategoria.set(def.categoria, [...(porCategoria.get(def.categoria) ?? []), def]);
  }

  async function mudar(atual: PreferenciaNotificacao, campo: "noApp" | "push", valor: boolean) {
    setSalvando(`${atual.tipo}:${campo}`);
    await salvarPreferencia({ ...atual, [campo]: valor });
    setSalvando(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Notificações"
        descricao="Escolha o que aparece no sino e o que chega no celular. Vale só para você."
      />

      <AtivarPush />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {[...porCategoria].map(([categoria, tipos]) => (
          <Card key={categoria}>
            <CardConteudo className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 pb-2">
                <CardTitulo>{ROTULO_CATEGORIA[categoria]}</CardTitulo>
                <div className="flex shrink-0 gap-3 text-[11px] text-muted-fg">
                  <span className="w-11 text-center">No sino</span>
                  <span className="w-11 text-center">Celular</span>
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {tipos.map((def) => {
                  const pref = preferenciaDe(preferencias, def.tipo);
                  const tom = estiloDoTom(def.tom);
                  return (
                    <li key={def.tipo} className="flex items-center gap-3 py-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full"
                        style={{ color: tom.cor, backgroundColor: tom.fundo }}
                      >
                        <Icone nome={def.icone} size={16} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{def.rotulo}</span>
                        <CardDescricao className="text-[12px]">{def.descricao}</CardDescricao>
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <Interruptor
                          checked={pref.noApp}
                          disabled={salvando === `${def.tipo}:noApp`}
                          onCheckedChange={(v) => void mudar(pref, "noApp", v)}
                          aria-label={`${def.rotulo} no sino`}
                        />
                        <Interruptor
                          checked={pref.push}
                          disabled={!pref.noApp || salvando === `${def.tipo}:push`}
                          onCheckedChange={(v) => void mudar(pref, "push", v)}
                          aria-label={`${def.rotulo} no celular`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardConteudo>
          </Card>
        ))}
      </div>
    </div>
  );
}

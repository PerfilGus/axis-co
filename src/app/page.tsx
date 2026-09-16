"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GRUPOS_POR_PERFIL } from "@/lib/nav";
import { useSessao } from "@/lib/providers/sessao";

/** A raiz leva cada perfil para a primeira tela a que ele tem acesso. */
export default function Raiz() {
  const router = useRouter();
  const { perfil } = useSessao();

  useEffect(() => {
    router.replace(GRUPOS_POR_PERFIL[perfil][0].href);
  }, [router, perfil]);

  return null;
}

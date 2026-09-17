import type { MetadataRoute } from "next";

/**
 * Manifest do app instalado. No iPhone, o push só funciona com o sistema
 * adicionado à tela de início e aberto em modo standalone (iOS 16.4+).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Axis — Sistema de gestão",
    short_name: "Axis",
    description: "Pedidos, envios, cobrança e equipe.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      { src: "/icones/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

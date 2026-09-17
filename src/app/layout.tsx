import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AparenciaProvider, SCRIPT_APARENCIA } from "@/lib/providers/aparencia";
import { ProvedorDica } from "@/components/ui/tooltip";
import { Avisos } from "@/components/ui/toast";

/** Fonte única do sistema. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Axis — Sistema de gestão",
  description:
    "Gestão de pedidos, envios, cobrança e equipe para venda com pagamento na entrega.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
    { media: "(prefers-color-scheme: light)", color: "#eaeaea" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="dark" data-accent="amarelo" suppressHydrationWarning>
      <head>
        {/* Aplica tema e destaque salvos antes da primeira pintura. */}
        <script nonce={(await headers()).get("x-nonce") ?? undefined} dangerouslySetInnerHTML={{ __html: SCRIPT_APARENCIA }} />
      </head>
      <body className={`${spaceGrotesk.variable} antialiased`}>
        <AparenciaProvider>
          <ProvedorDica delayDuration={250}>
            {children}
            <Avisos />
          </ProvedorDica>
        </AparenciaProvider>
      </body>
    </html>
  );
}

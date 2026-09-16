import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AparenciaProvider, SCRIPT_APARENCIA } from "@/lib/providers/aparencia";
import { SessaoProvider } from "@/lib/providers/sessao";
import { PedidosProvider } from "@/lib/providers/pedidos";
import { EquipeProvider } from "@/lib/providers/equipe";
import { CadastrosProvider } from "@/lib/providers/cadastros";
import { FinanceiroProvider } from "@/lib/providers/financeiro";
import { MarketingProvider } from "@/lib/providers/marketing";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="dark" data-accent="amarelo" suppressHydrationWarning>
      <head>
        {/* Aplica tema e destaque salvos antes da primeira pintura. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_APARENCIA }} />
      </head>
      <body className={`${spaceGrotesk.variable} antialiased`}>
        <AparenciaProvider>
          <EquipeProvider>
            <SessaoProvider>
              <CadastrosProvider>
                <PedidosProvider>
                  <FinanceiroProvider>
                    <MarketingProvider>
                      <ProvedorDica delayDuration={250}>
                        {children}
                        <Avisos />
                      </ProvedorDica>
                    </MarketingProvider>
                  </FinanceiroProvider>
                </PedidosProvider>
              </CadastrosProvider>
            </SessaoProvider>
          </EquipeProvider>
        </AparenciaProvider>
      </body>
    </html>
  );
}

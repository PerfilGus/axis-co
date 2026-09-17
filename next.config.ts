import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  poweredByHeader: false,
  // Binário nativo do argon2: fica fora do bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Pedido com print e áudio sobe numa ação só; imagens já vão comprimidas.
    serverActions: { bodySizeLimit: "32mb" },
    proxyClientMaxBodySize: "32mb",
  },
};

export default nextConfig;

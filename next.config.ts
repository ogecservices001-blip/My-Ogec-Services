import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: {
    // Active next/navigation `forbidden()`/`unauthorized()`, utilisés
    // par src/lib/auth.ts pour les accès refusés (rôle insuffisant).
    authInterrupts: true,
  },
};

export default nextConfig;

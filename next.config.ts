import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: {
    // Active next/navigation `forbidden()`/`unauthorized()`, utilisés
    // par src/lib/auth.ts pour les accès refusés (rôle insuffisant).
    authInterrupts: true,
    // Par défaut 1 Mo — trop petit pour l'upload d'un devis fournisseur
    // (PDF ou photo) envoyé à analyserDevisFournisseur.
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;

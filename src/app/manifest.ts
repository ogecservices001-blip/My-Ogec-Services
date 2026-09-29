import type { MetadataRoute } from "next";

/// Manifest PWA — permet l'installation ("Ajouter à l'écran d'accueil")
/// depuis Chrome mobile, sans passer par un APK natif.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OGEC Services",
    short_name: "OGEC Services",
    description: "CERFA, Répertoire, GMAO et Bon d'intervention — OGEC Services",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f9a41",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

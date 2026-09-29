"use client";

import { useEffect } from "react";

/// Enregistre le service worker minimal (public/sw.js) — condition
/// nécessaire côté Chrome pour que le site soit reconnu comme
/// installable ("Ajouter à l'écran d'accueil").
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

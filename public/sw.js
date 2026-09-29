// Service worker minimal — sa seule raison d'être est de rendre le
// site installable ("Ajouter à l'écran d'accueil") côté Chrome mobile.
// Pas de cache offline pour l'instant : réseau direct à chaque requête.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Volontairement vide (pas de respondWith) : laisse passer la requête
  // réseau normalement.
});

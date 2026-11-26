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

// Notifications (dépannage affecté au technicien) : affichées même appli
// fermée ; un appui ouvre l'appli sur la page indiquée.
self.addEventListener("push", (event) => {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch {
    donnees = { texte: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(donnees.titre || "OGEC Services", {
      body: donnees.texte || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: donnees.tag || undefined,
      data: { url: donnees.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url.startsWith(self.location.origin) && "focus" in f) {
          f.navigate(url);
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

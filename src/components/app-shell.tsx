"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

/// Écrans qui ont besoin de toute la largeur de la fenêtre (tableaux
/// denses type classeur) plutôt que l'appli centrée dans une colonne
/// à max-w-6xl — liste explicite en égalité stricte (pas un préfixe :
/// "/devis" ne doit pas élargir "/devis/importer" par ex.), le défaut
/// reste la colonne centrée pour ne jamais élargir un écran par
/// accident. Contrôle à la fois le conteneur global (sidebar incluse)
/// et la colonne de contenu, pour que les deux s'accordent.
const LARGEUR_PLEINE = [
  "/planning",
  "/planning/audit-heures",
  "/planning/heures-par-pole",
  "/bi",
  "/bi/valides",
  "/depannages/traitees",
  "/depannages/statistiques",
  "/prestations/realisees",
  "/prestations/annulees",
];
/// Sections entières (toutes les sous-pages), réservées à l'admin.
const LARGEUR_PLEINE_SECTIONS = ["/devis", "/commandes-fournisseur"];
/// Fiches de détail dynamiques (/depannages/{id}, /bi/{id}) — un
/// préfixe sur "/bi" élargirait aussi "nouveau" (assistant technicien),
/// qui doit rester en colonne centrée ; "/bi/{id}/pdf" ne matche pas
/// (pas une page).
const LARGEUR_PLEINE_PATTERNS = [/^\/depannages\/[0-9a-f-]{20,}$/i, /^\/bi\/[0-9a-f-]{20,}$/i];

/// Écrans qui se passent entièrement de la sidebar (grille dense où
/// chaque pixel compte) — la page elle-même doit alors fournir son
/// propre bouton retour, puisque la sidebar n'est plus là pour naviguer.
const SANS_SIDEBAR = ["/planning", "/planning/audit-heures", "/planning/heures-par-pole"];

export function AppShell({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pleine =
    LARGEUR_PLEINE.includes(pathname) ||
    LARGEUR_PLEINE_SECTIONS.some((s) => pathname === s || pathname.startsWith(`${s}/`)) ||
    LARGEUR_PLEINE_PATTERNS.some((re) => re.test(pathname));

  if (SANS_SIDEBAR.includes(pathname)) {
    return <main className="min-h-dvh w-full p-4 sm:p-6">{children}</main>;
  }

  return (
    <div className={`mx-auto flex ${pleine ? "" : "max-w-6xl"}`}>
      <Sidebar isAdmin={isAdmin} />
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <div className={`mx-auto w-full ${pleine ? "" : "max-w-3xl"}`}>{children}</div>
      </main>
    </div>
  );
}

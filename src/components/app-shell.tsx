"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { construireModules, type Module } from "@/lib/menus";

/// Racine d'un module = préfixe de chemin commun à tous ses
/// sous-menus (ex. "/repertoire/clients", ".../fournisseurs",
/// ".../collaborateurs" → "/repertoire", la page d'accueil du module,
/// même si elle n'est le href d'aucun sous-menu) — jamais juste "le
/// premier sous-menu", qui ramènerait au hasard sur une sous-page
/// précise plutôt que sur l'accueil du module.
function racineModule(m: Module): string | undefined {
  const chemins = m.sousMenus.filter((s) => s.href).map((s) => s.href!.split("?")[0].split("/").filter(Boolean));
  if (chemins.length === 0) return undefined;
  const longueurMin = Math.min(...chemins.map((c) => c.length));
  const racine: string[] = [];
  for (let i = 0; i < longueurMin; i++) {
    const segment = chemins[0][i];
    if (chemins.every((c) => c[i] === segment)) racine.push(segment);
    else break;
  }
  return racine.length > 0 ? `/${racine.join("/")}` : undefined;
}

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
  "/repertoire/clients",
  "/repertoire/fournisseurs",
  "/repertoire/collaborateurs",
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

/// Module/sous-menu correspondant au chemin actuel — même logique de
/// correspondance (exact ou préfixe de fiche détail) que la barre
/// latérale, pour que le fil d'ariane reste cohérent avec le volet
/// ouvert au survol.
function Fil({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cheminActuel = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  const modules = construireModules(isAdmin);

  let moduleCourant: (typeof modules)[number] | undefined;
  let sousMenuCourant: { nom: string; href?: string } | undefined;
  for (const m of modules) {
    const s = m.sousMenus.find((s) => s.href === cheminActuel);
    if (s) {
      moduleCourant = m;
      sousMenuCourant = s;
      break;
    }
  }
  if (!moduleCourant) {
    for (const m of modules) {
      const s = m.sousMenus.find((s) => s.href && pathname.startsWith(`${s.href.split("?")[0]}/`));
      if (s) {
        moduleCourant = m;
        sousMenuCourant = s;
        break;
      }
    }
  }

  if (!moduleCourant) return null;

  const hrefModule = racineModule(moduleCourant);

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 sm:px-6">
      <Link href="/" className="text-xs text-slate-400 transition hover:text-brand-green-dark">
        Accueil
      </Link>
      <ChevronRight className="h-3 w-3 text-slate-300" />
      {hrefModule && sousMenuCourant ? (
        <Link href={hrefModule} className="text-xs font-medium text-slate-500 transition hover:text-brand-green-dark">
          {moduleCourant.nom}
        </Link>
      ) : (
        <span className="text-xs font-medium text-brand-green-dark">{moduleCourant.nom}</span>
      )}
      {sousMenuCourant && (
        <>
          <ChevronRight className="h-3 w-3 text-slate-300" />
          <span className="text-xs font-medium text-brand-green-dark">{sousMenuCourant.nom}</span>
        </>
      )}
    </div>
  );
}

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
    <div className="flex">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <Fil isAdmin={isAdmin} />
        </Suspense>
        <main className={`mx-auto w-full flex-1 p-4 sm:p-6 ${pleine ? "" : "max-w-6xl"}`}>
          <div className={`mx-auto w-full ${pleine ? "" : "max-w-3xl"}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}

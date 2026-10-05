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
const LARGEUR_PLEINE = ["/gmao/audit-heures", "/devis"];

export function AppShell({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pleine = LARGEUR_PLEINE.includes(pathname);

  return (
    <div className={`mx-auto flex ${pleine ? "" : "max-w-6xl"}`}>
      <Sidebar isAdmin={isAdmin} />
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <div className={`mx-auto w-full ${pleine ? "" : "max-w-3xl"}`}>{children}</div>
      </main>
    </div>
  );
}

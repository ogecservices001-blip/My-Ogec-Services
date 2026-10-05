"use client";

import { usePathname } from "next/navigation";

/// Écrans qui ont besoin de toute la largeur disponible (tableaux
/// denses type classeur) plutôt que la colonne de lecture centrée à
/// 768px utilisée partout ailleurs — liste explicite en égalité stricte
/// (pas un préfixe : "/devis" ne doit pas élargir "/devis/importer" ou
/// "/devis/site/[id]", restés en colonne étroite), le défaut reste la
/// colonne étroite pour ne jamais élargir un écran par accident.
const LARGEUR_PLEINE = ["/gmao/audit-heures", "/devis"];

export function ContentWidth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pleine = LARGEUR_PLEINE.includes(pathname);
  return <div className={`mx-auto w-full ${pleine ? "" : "max-w-3xl"}`}>{children}</div>;
}

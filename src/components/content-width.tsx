"use client";

import { usePathname } from "next/navigation";

/// Écrans qui ont besoin de toute la largeur disponible (tableaux
/// denses type classeur) plutôt que la colonne de lecture centrée à
/// 768px utilisée partout ailleurs — liste explicite, le défaut reste
/// la colonne étroite pour ne jamais élargir un écran par accident.
const LARGEUR_PLEINE = ["/gmao/audit-heures"];

export function ContentWidth({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pleine = LARGEUR_PLEINE.some((p) => pathname.startsWith(p));
  return <div className={`mx-auto w-full ${pleine ? "" : "max-w-3xl"}`}>{children}</div>;
}

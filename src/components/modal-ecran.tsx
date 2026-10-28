"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/// Habillage "popup" (fenêtre par-dessus l'écran, fond assombri,
/// panneau blanc défilant) pour les écrans de création — même
/// présentation que "Créer un client" chez MyOgec Services. Le
/// contenu (formulaire, logique métier, validation) reste exactement
/// celui de la page d'origine ; seul l'habillage change.
///
/// `hrefFermer` : utilisé si JS est désactivé / avant hydratation (le
/// Link reste un vrai lien) ; une fois hydraté, la croix revient en
/// arrière dans l'historique (router.back()) pour ne pas perdre un
/// filtre/une recherche sur l'écran précédent — sauf si le visiteur
/// est arrivé directement sur l'URL (pas d'historique), auquel cas on
/// retombe sur hrefFermer.
export function ModalEcran({
  titre,
  hrefFermer,
  large,
  children,
}: {
  titre: string;
  hrefFermer: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function fermer() {
    if (window.history.length > 1) router.back();
    else router.push(hrefFermer);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8 sm:items-center">
      <div
        className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${
          large ? "max-w-4xl" : "max-w-xl"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">{titre}</h1>
          <Link
            href={hrefFermer}
            onClick={(e) => {
              e.preventDefault();
              fermer();
            }}
            title="Fermer"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

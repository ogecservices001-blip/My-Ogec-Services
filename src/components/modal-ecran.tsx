"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/// Habillage plein écran pour les écrans de création/modification —
/// même convention que le reste de l'appli (lien "Retour" + titre),
/// pas une popup par-dessus l'écran. Le contenu (formulaire, logique
/// métier, validation) reste exactement celui de la page d'origine ;
/// seul l'habillage change.
///
/// `hrefFermer` : utilisé si JS est désactivé / avant hydratation (le
/// Link reste un vrai lien) ; une fois hydraté, "Retour" revient en
/// arrière dans l'historique (router.back()) pour ne pas perdre un
/// filtre/une recherche sur l'écran précédent — sauf si le visiteur
/// est arrivé directement sur l'URL (pas d'historique), auquel cas on
/// retombe sur hrefFermer.
export function ModalEcran({
  titre,
  hrefFermer,
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
    <div>
      <Link
        href={hrefFermer}
        onClick={(e) => {
          e.preventDefault();
          fermer();
        }}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">{titre}</h1>
      {children}
    </div>
  );
}

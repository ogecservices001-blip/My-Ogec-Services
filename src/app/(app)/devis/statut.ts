import { Statuts } from "@/lib/bi/constants";

/// Un devis est "réalisé" dès que son BI est transmis par le
/// technicien (statut différent de brouillon) — même logique que
/// Prestation sur commande.
export const STATUTS_BI_REALISE = new Set<string>(
  Object.values(Statuts).filter((s) => s !== Statuts.brouillon),
);

export type StatutDevis = "en_cours" | "attente" | "commande" | "realise" | "facturable" | "annule";

/// "Facturable" (mois de facturation saisi) prime sur "Réalisé" à
/// l'affichage — c'est l'étape suivante dans le cycle de vie, même si
/// elle n'est pas techniquement exclusive de "réalisé". Un devis sans
/// numéro n'a pas encore été finalisé (brouillon enregistré depuis
/// "Nouveau devis" avec "Enregistrer") — toujours "Devis en cours",
/// sauf s'il a été annulé entre-temps.
export function calculerStatutDevis(d: {
  numero: string;
  annule: boolean;
  commande: boolean;
  realise: boolean;
  facturable: boolean;
}): StatutDevis {
  if (d.annule) return "annule";
  if (!d.numero) return "en_cours";
  if (d.facturable) return "facturable";
  if (d.realise) return "realise";
  if (d.commande) return "commande";
  return "attente";
}

export const LABEL_STATUT_DEVIS: Record<StatutDevis, string> = {
  en_cours: "Devis en cours",
  attente: "En attente",
  commande: "Commandé",
  realise: "Réalisé",
  facturable: "Facturable",
  annule: "Annulée",
};

export const TEINTE_STATUT_DEVIS: Record<StatutDevis, string> = {
  en_cours: "bg-amber-100 text-amber-700",
  attente: "bg-slate-100 text-slate-500",
  commande: "bg-green-100 text-brand-green-dark",
  realise: "bg-blue-100 text-blue-700",
  facturable: "bg-teal-100 text-teal-700",
  annule: "bg-red-100 text-red-700",
};

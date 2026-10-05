import { Statuts } from "@/lib/bi/constants";

/// Un devis est "réalisé" dès que son BI est transmis par le
/// technicien (statut différent de brouillon) — même logique que
/// Prestation sur commande.
export const STATUTS_BI_REALISE = new Set<string>(
  Object.values(Statuts).filter((s) => s !== Statuts.brouillon),
);

export type StatutDevis = "attente" | "commande" | "realise" | "annule";

export function calculerStatutDevis(d: { annule: boolean; commande: boolean; realise: boolean }): StatutDevis {
  if (d.annule) return "annule";
  if (d.realise) return "realise";
  if (d.commande) return "commande";
  return "attente";
}

export const LABEL_STATUT_DEVIS: Record<StatutDevis, string> = {
  attente: "En attente",
  commande: "Commandé",
  realise: "Réalisé",
  annule: "Annulée",
};

export const TEINTE_STATUT_DEVIS: Record<StatutDevis, string> = {
  attente: "bg-slate-100 text-slate-500",
  commande: "bg-green-100 text-brand-green-dark",
  realise: "bg-blue-100 text-blue-700",
  annule: "bg-red-100 text-red-700",
};

/// Nature d'un travail — reprise du devis (voir Devis.nature) et
/// choisie par le technicien au moment du Bon d'intervention quand
/// aucun devis ne s'applique. Mêmes codes que le pôle du Bon
/// d'intervention (voir src/lib/bi/constants.ts) — nature et pôle
/// désignent la même chose, une seule échelle de codes pour les deux.
export const NATURE_DEVIS: Record<string, string> = {
  "10": "Installation neuve",
  "15": "Remplacement à l'identique",
  "20": "Entretien sous contrat",
  "25": "Entretien hors contrat",
  "30": "Réparation d'un équipement",
  "35": "Réparation diverse",
  "40": "Mise à disposition d'équipement",
  "50": "Livraison de matériel",
};

export function labelNatureDevis(code: string): string {
  return NATURE_DEVIS[code] ?? code;
}

/// Natures proposées à la création/au filtrage d'un devis — "Entretien
/// sous contrat" (code 20) exclu : c'est déjà couvert par le contrat en
/// cours, un devis n'a jamais de raison d'exister pour ça.
export const NATURES_DEVIS_SELECTIONNABLES: Record<string, string> = Object.fromEntries(
  Object.entries(NATURE_DEVIS).filter(([code]) => code !== "20"),
);

/// Nature d'un travail — choisie par le technicien sur le terrain au
/// moment du Bon d'intervention correspondant, pas obligatoire à la
/// création de l'affaire par le bureau (le travail réel n'est parfois
/// su qu'une fois sur place). Mêmes codes que le pôle du Bon
/// d'intervention (Prompt 9b) — nature et pôle désignent la même
/// chose, une seule échelle de codes pour les deux.
export const NATURE_AFFAIRE: Record<string, string> = {
  "10": "Installation neuve",
  "15": "Remplacement à l'identique",
  "20": "Entretien sous contrat",
  "25": "Entretien hors contrat",
  "30": "Réparation d'un équipement",
  "35": "Réparation diverse",
  "40": "Mise à disposition d'équipement",
  "50": "Livraison de matériel",
};

export function labelNatureAffaire(code: string): string {
  return NATURE_AFFAIRE[code] ?? code;
}

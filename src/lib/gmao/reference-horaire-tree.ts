import type { ReferenceHoraire } from "./types";

/// Nœud de l'arborescence Famille → Sous-famille → Puissance, construit
/// directement depuis type_equipement1/2/3 — port de
/// reference_horaire_tree.dart.
export type NoeudReference = {
  label: string;
  enfants: NoeudReference[];
  feuilles: ReferenceHoraire[];
};

export type ArbreReferences = {
  racines: NoeudReference[];
};

/// Segments explicites d'une ligne (type1/2/3, non vides). Si les 3
/// sont vides, on se rabat sur la désignation entière comme unique
/// segment.
function segments(r: ReferenceHoraire): string[] {
  const segs = [r.type_equipement1, r.type_equipement2, r.type_equipement3]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
  return segs.length > 0 ? segs : [r.designation.trim()];
}

function labelAuNiveau(r: ReferenceHoraire, niveau: number): string {
  const segs = segments(r);
  return niveau < segs.length ? segs[niveau] : r.designation.trim();
}

function grouperPar<T>(items: T[], cle: (item: T) => string): Map<string, T[]> {
  const parCle = new Map<string, T[]>();
  for (const item of items) {
    const k = cle(item);
    const liste = parCle.get(k) ?? [];
    liste.push(item);
    parCle.set(k, liste);
  }
  return parCle;
}

function construire(label: string, groupe: ReferenceHoraire[], niveau: number): NoeudReference {
  if (groupe.length === 1) {
    return { label, enfants: [], feuilles: [groupe[0]] };
  }

  const parLabel = grouperPar(groupe, (r) => labelAuNiveau(r, niveau));

  // Le regroupement à ce niveau ne distingue plus rien (type1/2/3 et
  // désignation épuisés pour tout le groupe) : ces références
  // deviennent des feuilles directes de ce nœud plutôt que de boucler.
  if (parLabel.size === 1) {
    return { label, enfants: [], feuilles: groupe };
  }

  const enfants = [...parLabel.entries()]
    .map(([cle, valeur]) => construire(cle, valeur, niveau + 1))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { label, enfants, feuilles: [] };
}

export function construireArbreReferences(references: ReferenceHoraire[]): ArbreReferences {
  const racineParLabel = grouperPar(references, (r) => labelAuNiveau(r, 0));

  const racines = [...racineParLabel.entries()]
    .map(([cle, valeur]) => construire(cle, valeur, 1))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { racines };
}

export function compterFeuilles(noeud: NoeudReference): number {
  let total = noeud.feuilles.length;
  for (const enfant of noeud.enfants) total += compterFeuilles(enfant);
  return total;
}

import type { ChampsEnTeteEquipement, ReferenceHoraire } from "./types";

function normaliser(s: string): string {
  return s.trim().toLowerCase();
}

function champTexte(champs: ChampsEnTeteEquipement, cle: string): string {
  const v = champs[cle];
  return typeof v === "string" ? v : "";
}

/// Extrait la valeur numérique d'une puissance/débit texte (ex: "10.6 kw"
/// → 10.6, "1000 m3/h" → 1000) — `null` si aucun nombre trouvé.
function valeurNumerique(texte: string): number | null {
  const match = texte.match(/[\d]+[.,]?[\d]*/);
  if (!match) return null;
  const n = Number(match[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type ResultatReference = {
  reference: ReferenceHoraire | null;
  approchee: boolean;
  horsCatalogue: boolean;
};

/// Cherche la ligne du catalogue dont Type Equipement 1/2/3 correspond à
/// ceux de l'équipement (insensible à la casse/espaces). Correspondance
/// exacte en priorité ; à défaut, la taille (Type Equipement 3)
/// immédiatement supérieure disponible pour la même Type Equipement 1 +
/// 2 — jamais une taille inférieure, jamais entre familles différentes.
/// Port fidèle de `analyserReference` (suggestion_reference_horaire.dart).
export function analyserReference(
  champsEnTete: ChampsEnTeteEquipement,
  references: ReferenceHoraire[],
): ResultatReference {
  const t1 = normaliser(champTexte(champsEnTete, "typeEquipement1"));
  if (!t1) return { reference: null, approchee: false, horsCatalogue: false };
  const t2 = normaliser(champTexte(champsEnTete, "typeEquipement2"));
  const t3Brut = champTexte(champsEnTete, "typeEquipement3");
  const t3 = normaliser(t3Brut);

  for (const r of references) {
    if (
      normaliser(r.type_equipement1) === t1 &&
      normaliser(r.type_equipement2) === t2 &&
      normaliser(r.type_equipement3) === t3
    ) {
      return { reference: r, approchee: false, horsCatalogue: false };
    }
  }

  const puissanceEquipement = valeurNumerique(t3Brut);
  const memeFamille = references.filter(
    (r) => normaliser(r.type_equipement1) === t1 && normaliser(r.type_equipement2) === t2,
  );
  if (puissanceEquipement === null || memeFamille.length === 0) {
    return { reference: null, approchee: false, horsCatalogue: false };
  }

  let meilleure: ReferenceHoraire | null = null;
  let meilleurePuissance: number | null = null;
  for (const r of memeFamille) {
    const p = valeurNumerique(r.type_equipement3);
    if (p === null || p < puissanceEquipement) continue;
    if (meilleurePuissance === null || p < meilleurePuissance) {
      meilleurePuissance = p;
      meilleure = r;
    }
  }

  if (meilleure) return { reference: meilleure, approchee: true, horsCatalogue: false };
  return { reference: null, approchee: false, horsCatalogue: true };
}

export function trouverReferenceExacte(
  champsEnTete: ChampsEnTeteEquipement,
  references: ReferenceHoraire[],
): ReferenceHoraire | null {
  return analyserReference(champsEnTete, references).reference;
}

/// Concatène "Type Equipement 1-2-3" pour l'affichage (ex: "Split
/// Autonome-Murale-3.5 kw") — segments vides ignorés.
export function concatTypeEquipement(champsEnTete: ChampsEnTeteEquipement): string {
  return ["typeEquipement1", "typeEquipement2", "typeEquipement3"]
    .map((cle) => champTexte(champsEnTete, cle).trim())
    .filter((s) => s.length > 0)
    .join("-");
}

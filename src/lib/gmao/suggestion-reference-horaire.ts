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

/// Cherche, parmi `candidats`, la taille (lue via `champ`) immédiatement
/// supérieure ou égale à celle de l'équipement — jamais une taille
/// inférieure.
function approcherParTaille(
  texteBrut: string,
  candidats: ReferenceHoraire[],
  champ: (r: ReferenceHoraire) => string,
): ReferenceHoraire | null {
  const puissanceEquipement = valeurNumerique(texteBrut);
  if (puissanceEquipement === null || candidats.length === 0) return null;

  let meilleure: ReferenceHoraire | null = null;
  let meilleurePuissance: number | null = null;
  for (const r of candidats) {
    const p = valeurNumerique(champ(r));
    if (p === null || p < puissanceEquipement) continue;
    if (meilleurePuissance === null || p < meilleurePuissance) {
      meilleurePuissance = p;
      meilleure = r;
    }
  }
  return meilleure;
}

/// Cherche la ligne du catalogue dont Type Equipement 1/2/3 correspond à
/// ceux de l'équipement (insensible à la casse/espaces). Correspondance
/// exacte en priorité ; à défaut, la taille immédiatement supérieure
/// disponible — jamais une taille inférieure, jamais entre familles
/// différentes. La taille se lit en Type Equipement 3 pour les familles
/// à sous-catégorie réelle (ex: Unité intérieure VRV : famille +
/// Cassette/Murale + kw, Type Equipement 2 alors fixe) ; sinon
/// directement en Type Equipement 2 (ex: Groupe VRV : famille + kw,
/// pas de sous-catégorie). Port fidèle de `analyserReference`
/// (suggestion_reference_horaire.dart), étendu pour ce second cas.
export function analyserReference(
  champsEnTete: ChampsEnTeteEquipement,
  references: ReferenceHoraire[],
): ResultatReference {
  const t1 = normaliser(champTexte(champsEnTete, "typeEquipement1"));
  if (!t1) return { reference: null, approchee: false, horsCatalogue: false };
  const t2Brut = champTexte(champsEnTete, "typeEquipement2");
  const t2 = normaliser(t2Brut);
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

  const memeFamilleT1T2 = references.filter(
    (r) => normaliser(r.type_equipement1) === t1 && normaliser(r.type_equipement2) === t2,
  );
  const approcheeT3 = approcherParTaille(t3Brut, memeFamilleT1T2, (r) => r.type_equipement3);
  if (approcheeT3) return { reference: approcheeT3, approchee: true, horsCatalogue: false };

  let memeFamilleT1SansT3: ReferenceHoraire[] = [];
  if (!t3Brut) {
    memeFamilleT1SansT3 = references.filter(
      (r) => normaliser(r.type_equipement1) === t1 && !r.type_equipement3,
    );
    const approcheeT2 = approcherParTaille(t2Brut, memeFamilleT1SansT3, (r) => r.type_equipement2);
    if (approcheeT2) return { reference: approcheeT2, approchee: true, horsCatalogue: false };
  }

  const horsCatalogue = memeFamilleT1T2.length > 0 || memeFamilleT1SansT3.length > 0;
  return { reference: null, approchee: false, horsCatalogue };
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

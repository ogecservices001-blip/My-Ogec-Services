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

/// Segments non vides d'une ligne du catalogue (Type Equipement 1/2/3,
/// normalisés) — même logique que `segments()` dans
/// reference-horaire-tree.ts, pour que la correspondance soit
/// insensible à la colonne où une famille range sa taille (certaines
/// familles la rangent en Type Equipement 2, d'autres en 3, sans que
/// ce soit toujours cohérent dans le référentiel).
function segmentsReference(r: ReferenceHoraire): string[] {
  return [r.type_equipement1, r.type_equipement2, r.type_equipement3]
    .map((s) => normaliser(s ?? ""))
    .filter((s) => s.length > 0);
}

/// Cherche la ligne du catalogue dont les segments (Type Equipement
/// 1/2/3, vides ignorés) correspondent à ceux de l'équipement.
/// Correspondance exacte en priorité ; à défaut, même famille et même
/// chemin de sous-catégorie (tous les segments sauf le dernier, qui
/// est la taille), avec la taille immédiatement supérieure ou égale
/// disponible — jamais une taille inférieure, jamais entre familles
/// différentes. Port de `analyserReference` (suggestion_reference_
/// horaire.dart), généralisé par segments plutôt que par colonne fixe.
export function analyserReference(
  champsEnTete: ChampsEnTeteEquipement,
  references: ReferenceHoraire[],
): ResultatReference {
  const t1 = normaliser(champTexte(champsEnTete, "typeEquipement1"));
  if (!t1) return { reference: null, approchee: false, horsCatalogue: false };
  const t2 = normaliser(champTexte(champsEnTete, "typeEquipement2"));
  const t3 = normaliser(champTexte(champsEnTete, "typeEquipement3"));
  const segsEquipement = [t1, t2, t3].filter((s) => s.length > 0);

  for (const r of references) {
    const segsRef = segmentsReference(r);
    if (segsRef.length === segsEquipement.length && segsRef.every((s, i) => s === segsEquipement[i])) {
      return { reference: r, approchee: false, horsCatalogue: false };
    }
  }

  let approchee: ReferenceHoraire | null = null;
  if (segsEquipement.length >= 2) {
    const prefixe = segsEquipement.slice(0, -1);
    const tailleEquipement = valeurNumerique(segsEquipement[segsEquipement.length - 1]);
    if (tailleEquipement !== null) {
      let meilleureTaille: number | null = null;
      for (const r of references) {
        const segsRef = segmentsReference(r);
        if (segsRef.length !== segsEquipement.length) continue;
        if (!prefixe.every((s, i) => segsRef[i] === s)) continue;
        const taille = valeurNumerique(segsRef[segsRef.length - 1]);
        if (taille === null || taille < tailleEquipement) continue;
        if (meilleureTaille === null || taille < meilleureTaille) {
          meilleureTaille = taille;
          approchee = r;
        }
      }
    }
  }
  if (approchee) return { reference: approchee, approchee: true, horsCatalogue: false };

  const horsCatalogue = references.some((r) => segmentsReference(r)[0] === t1);
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

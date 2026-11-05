import type { LigneDevis } from "./pricing";

/// Nature d'un devis dont les pavés n'ont pas tous la même nature.
export const NATURE_MULTIPLE = "PN";

export type PaveDevis = {
  equipementId: string | null;
  equipementNom: string;
  localisation: string;
  libelle: string;
  nature: string;
  lignes: LigneDevis[];
};

type DevisAvecPaves = {
  paves: unknown;
  equipement_id: string | null;
  equipements_supplementaires: string[];
  localisation: string;
  libelle: string;
  nature: string;
  lignes: unknown;
};

/// Pavés d'un devis. Un devis antérieur aux pavés (ou importé) donne un pavé
/// par équipement lié, ses lignes et son libellé allant sur le premier.
export function pavesDuDevis(devis: DevisAvecPaves): PaveDevis[] {
  const enregistres = devis.paves as PaveDevis[] | null;
  if (enregistres && enregistres.length > 0) return enregistres;

  const pavesSupplementaires = devis.equipements_supplementaires.map((equipementId) => ({
    equipementId,
    equipementNom: "",
    localisation: "",
    libelle: "",
    nature: devis.nature,
    lignes: [],
  }));
  return [
    {
      equipementId: devis.equipement_id,
      equipementNom: "",
      localisation: devis.localisation,
      libelle: devis.libelle,
      nature: devis.nature,
      lignes: (devis.lignes as LigneDevis[] | null) ?? [],
    },
    ...pavesSupplementaires,
  ];
}

function sansDoublon(valeurs: string[]): string[] {
  return [...new Set(valeurs.map((v) => v.trim()).filter(Boolean))];
}

/// Champs historiques du devis déduits de ses pavés.
export function aplatirPaves(paves: PaveDevis[]) {
  const equipementIds = paves.map((p) => p.equipementId).filter((id): id is string => Boolean(id));
  const natures = sansDoublon(paves.map((p) => p.nature));
  return {
    paves,
    equipement_id: equipementIds[0] ?? null,
    equipements_supplementaires: equipementIds.slice(1),
    localisation: sansDoublon(paves.map((p) => p.localisation)).join(", "),
    libelle: sansDoublon(paves.map((p) => p.libelle)).join(" / "),
    nature: natures.length > 1 ? NATURE_MULTIPLE : (natures[0] ?? ""),
    lignes: paves.flatMap((p) => p.lignes),
  };
}

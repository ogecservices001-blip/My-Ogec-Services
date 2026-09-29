import type { Equipement, TypeEquipement } from "./types";

/// Une ligne du classeur "Sommaire", déjà interprétée. Port de
/// `LigneImport` (equipement_import_service.dart).
export type LigneImportEquipement = {
  nom: string;
  numeroEquipement: string;
  localisation: string;
  groupe: string;
  typeDeReleveBrut: string;
  typeEquipementId: string | null;
  champsEnTete: Record<string, string>;
  numeroClientBrut: string;
  numeroSiteBrut: string;
};

export type DiffChamp = { label: string; ancienne: string; nouvelle: string };

export type DiffAjout = { ligne: LigneImportEquipement };
export type DiffModification = { existant: Equipement; ligne: LigneImportEquipement; champs: DiffChamp[] };
export type DiffSuppression = { existant: Equipement };

export type Avertissement = { message: string };

export type ResultatDiff = {
  ajouts: DiffAjout[];
  modifications: DiffModification[];
  suppressions: DiffSuppression[];
  avertissements: Avertissement[];
};

/// Extrait la partie numérique d'un texte (ex: "OS-044" → 44) — `null`
/// si aucun chiffre trouvé.
export function extraireNumero(texte: string): number | null {
  const match = texte.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/// Clé "numéroClient-numéroSite" d'un site, dérivée de son `n_affaire`
/// (ex: "092-01" → "92-1") — `null` si le format ne correspond pas.
export function cleNumeroSite(nAffaire: string): string | null {
  const parts = nAffaire.split("-");
  if (parts.length < 2) return null;
  const numClient = extraireNumero(parts[0]);
  const numSite = extraireNumero(parts.slice(1).join("-"));
  if (numClient === null || numSite === null) return null;
  return `${numClient}-${numSite}`;
}

const CHAMPS_CONNUS_LABELS: Record<string, string> = {
  typeEquipement2: "Type Equipement 2",
  typeEquipement3: "Type Equipement 3",
  marque: "Marque",
  dateMES: "Date M.E.S.",
  referenceUInt: "Référence unité intérieure",
  referenceUExt: "Référence unité extérieure",
  numSerieUInt: "Numéro Série unité intérieure",
  numSerieUExt: "Numéro Série unité extérieure",
  dateIntervPrevue: "Date Interv prévue",
  nomTech: "Nom Tech",
  typeRefrigerant: "Réfrigérant",
  chargeRefrigerant: "Charge Réfrigérant Kg",
  tensionAlim: "Tension Alim.",
  puissance: "Puissance",
  freqEntretienAnnuelle: "Fréquence entretien annuelle",
};

/// Compare les lignes importées (déjà filtrées pour ce site) à
/// l'existant et détermine ajouts/modifications/suppressions. Port de
/// `_calculerDiffPourUnSite` (equipement_import_service.dart).
export function calculerDiffPourSite(
  lignes: LigneImportEquipement[],
  existants: Equipement[],
  typesById: Record<string, TypeEquipement>,
): ResultatDiff {
  const avertissements: Avertissement[] = [];
  const ajouts: DiffAjout[] = [];
  const modifications: DiffModification[] = [];

  const numerosVus = new Set<string>();
  const existantsParNumero = new Map<string, Equipement>();
  for (const e of existants) {
    if (e.numero_equipement.trim()) existantsParNumero.set(e.numero_equipement.trim(), e);
  }

  for (const ligne of lignes) {
    const numero = ligne.numeroEquipement.trim();
    if (!numero) {
      avertissements.push({ message: `Numéro Équipement vide pour "${ligne.nom}" — ligne ignorée` });
      continue;
    }
    if (numerosVus.has(numero)) {
      avertissements.push({
        message: `Numéro Équipement "${numero}" en double dans le fichier — seule la première occurrence est prise en compte`,
      });
      continue;
    }
    numerosVus.add(numero);

    if (!ligne.typeEquipementId || !typesById[ligne.typeEquipementId]) {
      avertissements.push({
        message: `Famille inconnue "${ligne.typeDeReleveBrut}" pour "${numero}" — ligne ignorée`,
      });
      continue;
    }

    const type = typesById[ligne.typeEquipementId];
    // Type Equipement 1 est fixe par famille — jamais lu depuis le
    // fichier, toujours celui du référentiel.
    if (type.type_equipement1_fixe) {
      ligne.champsEnTete.typeEquipement1 = type.type_equipement1_fixe;
    }

    const existant = existantsParNumero.get(numero);
    if (!existant) {
      ajouts.push({ ligne });
      continue;
    }

    const champsDiff: DiffChamp[] = [];
    if (ligne.nom && ligne.nom !== existant.nom) {
      champsDiff.push({ label: "Nom", ancienne: existant.nom, nouvelle: ligne.nom });
    }
    if (ligne.localisation && ligne.localisation !== existant.localisation) {
      champsDiff.push({ label: "Localisation", ancienne: existant.localisation, nouvelle: ligne.localisation });
    }
    if (ligne.groupe && ligne.groupe !== existant.groupe) {
      champsDiff.push({ label: "Groupe", ancienne: existant.groupe, nouvelle: ligne.groupe });
    }

    const champsConnus = new Set(type.champs_en_tete_supplementaires.map((c) => c.cle));
    for (const [cle, valeur] of Object.entries(ligne.champsEnTete)) {
      if (!champsConnus.has(cle)) continue;
      const ancienne = typeof existant.champs_en_tete[cle] === "string" ? (existant.champs_en_tete[cle] as string) : "";
      if (valeur !== ancienne) {
        champsDiff.push({ label: CHAMPS_CONNUS_LABELS[cle] ?? cle, ancienne, nouvelle: valeur });
      }
    }

    if (champsDiff.length > 0) {
      modifications.push({ existant, ligne, champs: champsDiff });
    }
  }

  const suppressions: DiffSuppression[] = [...existantsParNumero.entries()]
    .filter(([numero]) => !numerosVus.has(numero))
    .map(([, existant]) => ({ existant }));

  return { ajouts, modifications, suppressions, avertissements };
}

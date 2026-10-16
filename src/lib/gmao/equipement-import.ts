import type { Equipement, TypeEquipement } from "./types";

/// Une ligne du classeur "Sommaire", déjà interprétée. Port de
/// `LigneImport` (equipement_import_service.dart).
export type LigneImportEquipement = {
  numeroLigne: number;
  nom: string;
  numeroEquipement: string;
  localisation: string;
  groupe: string;
  typeDeReleveBrut: string;
  typeEquipementId: string | null;
  champsEnTete: Record<string, string>;
  numeroClientBrut: string;
  numeroSiteBrut: string;
  /// Toutes les colonnes du fichier source, clé = en-tête normalisé
  /// (pas seulement celles connues/importées) — pour le rapport
  /// d'import, qui doit pouvoir réafficher la ligne telle quelle même
  /// pour des colonnes qu'on ne stocke pas (ex: "Informations
  /// complémentaires").
  colonnesBrutes: Record<string, string>;
};

export type DiffChamp = { label: string; ancienne: string; nouvelle: string };

export type DiffAjout = { ligne: LigneImportEquipement; siteId: string };
export type DiffModification = { existant: Equipement; ligne: LigneImportEquipement; champs: DiffChamp[] };
export type DiffSuppression = { existant: Equipement };

export type Avertissement = { message: string };

/// Une ligne du fichier source, telle que classée pour le rapport
/// d'import — contrairement à `ajouts`/`modifications`, couvre AUSSI
/// les lignes inchangées et ignorées (jamais filtré en silence).
export type StatutLigneAnalysee = "ajout" | "modification" | "inchange" | "ignoree";
export type LigneAnalysee = {
  numeroLigne: number;
  statut: StatutLigneAnalysee;
  raison: string;
  siteId: string | null;
  typeEquipementId: string | null;
  colonnesBrutes: Record<string, string>;
  /// En-têtes normalisés (mêmes clés que `colonnesBrutes`) dont la
  /// valeur diffère de l'existant en base — y compris les champs non
  /// déclarés dans le référentiel de la famille (eux ne sont pas
  /// appliqués à l'enregistrement, seulement signalés).
  colonnesModifiees: string[];
  /// Valeur en base AVANT l'import, pour les en-têtes listés dans
  /// `colonnesModifiees` uniquement — permet au rapport d'afficher
  /// "nouvelle valeur (était : ancienne valeur)".
  valeursAvant: Record<string, string>;
  /// Champs d'en-tête complets, tels qu'ils seront (ou sont déjà) en
  /// base après l'import — pour calculer les heures Tech/Assistant par
  /// an de la ligne dans le rapport.
  champsEnTeteApres: Record<string, string>;
};

/// En-tête du fichier source, dans son ordre et sa casse d'origine —
/// pour que le rapport d'import puisse reproduire le classeur tel
/// quel, colonne pour colonne.
export type EnTeteSource = { normalise: string; original: string };

export type ResultatDiff = {
  ajouts: DiffAjout[];
  modifications: DiffModification[];
  suppressions: DiffSuppression[];
  avertissements: Avertissement[];
  toutesLesLignes: LigneAnalysee[];
  enTetes: EnTeteSource[];
};

/// En-tête normalisé correspondant à chaque clé de `champsEnTete`
/// (inverse de `COLONNE_VERS_CLE` dans import-shared.ts) + tronc
/// commun — pour relier un champ modifié à sa colonne d'origine dans
/// le rapport.
export const ENTETE_NORMALISE_PAR_CLE: Record<string, string> = {
  nom: "nom equipements",
  localisation: "localisation",
  groupe: "groupe",
  typeEquipement2: "type equipement 2",
  typeEquipement3: "type equipement 3",
  marque: "marque",
  dateMES: "date m.e.s.",
  referenceUInt: "référence unité intérieure",
  referenceUExt: "référence unité extérieure",
  numSerieUInt: "numéro série unité intérieure",
  numSerieUExt: "numéro série unité extérieure",
  dateIntervPrevue: "date interv prévue",
  nomTech: "nom tech",
  typeRefrigerant: "réfrigérant",
  chargeRefrigerant: "charge réfrigérant kg",
  tensionAlim: "tension alim.",
  puissance: "puissance",
  freqEntretienAnnuelle: "fréquence entretien annuelle",
  dateDernierControle: "date dernier contrôle",
  dateProchainControle: "date prochain contrôle",
  numDernierBordereau: "n° dernier bordereau",
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
  dateDernierControle: "Date dernier contrôle",
  dateProchainControle: "Date Prochain contrôle",
  numDernierBordereau: "N° dernier bordereau",
};

/// Compare les lignes importées (déjà filtrées pour ce site) à
/// l'existant et détermine ajouts/modifications/suppressions. Port de
/// `_calculerDiffPourUnSite` (equipement_import_service.dart).
export function calculerDiffPourSite(
  lignes: LigneImportEquipement[],
  existants: Equipement[],
  typesById: Record<string, TypeEquipement>,
  siteId: string,
): ResultatDiff {
  const avertissements: Avertissement[] = [];
  const ajouts: DiffAjout[] = [];
  const modifications: DiffModification[] = [];
  const toutesLesLignes: LigneAnalysee[] = [];

  const numerosVus = new Set<string>();
  const existantsParNumero = new Map<string, Equipement>();
  for (const e of existants) {
    if (e.numero_equipement.trim()) existantsParNumero.set(e.numero_equipement.trim(), e);
  }

  for (const ligne of lignes) {
    const noter = (
      statut: StatutLigneAnalysee,
      raison: string,
      colonnesModifiees: string[] = [],
      valeursAvant: Record<string, string> = {},
      champsEnTeteApres: Record<string, string> = ligne.champsEnTete,
    ) => {
      toutesLesLignes.push({
        numeroLigne: ligne.numeroLigne,
        statut,
        raison,
        siteId,
        typeEquipementId: ligne.typeEquipementId,
        colonnesBrutes: ligne.colonnesBrutes,
        colonnesModifiees,
        valeursAvant,
        champsEnTeteApres,
      });
    };

    const numero = ligne.numeroEquipement.trim();
    if (!numero) {
      avertissements.push({ message: `Numéro Équipement vide pour "${ligne.nom}" — ligne ignorée` });
      noter("ignoree", "Numéro Équipement vide");
      continue;
    }
    if (numerosVus.has(numero)) {
      avertissements.push({
        message: `Numéro Équipement "${numero}" en double dans le fichier — seule la première occurrence est prise en compte`,
      });
      noter("ignoree", "Numéro Équipement en double dans le fichier");
      continue;
    }
    numerosVus.add(numero);

    if (!ligne.typeEquipementId || !typesById[ligne.typeEquipementId]) {
      avertissements.push({
        message: `Famille inconnue "${ligne.typeDeReleveBrut}" pour "${numero}" — ligne ignorée`,
      });
      noter("ignoree", `Famille inconnue "${ligne.typeDeReleveBrut}"`);
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
      ajouts.push({ ligne, siteId });
      noter("ajout", "");
      continue;
    }

    const champsDiff: DiffChamp[] = [];
    const colonnesModifiees: string[] = [];
    const valeursAvant: Record<string, string> = {};
    const champsEnTeteExistantTexte: Record<string, string> = {};
    for (const [cle, v] of Object.entries(existant.champs_en_tete)) {
      if (typeof v === "string") champsEnTeteExistantTexte[cle] = v;
    }

    if (ligne.nom && ligne.nom !== existant.nom) {
      champsDiff.push({ label: "Nom", ancienne: existant.nom, nouvelle: ligne.nom });
      colonnesModifiees.push(ENTETE_NORMALISE_PAR_CLE.nom);
      valeursAvant[ENTETE_NORMALISE_PAR_CLE.nom] = existant.nom;
    }
    if (ligne.localisation && ligne.localisation !== existant.localisation) {
      champsDiff.push({ label: "Localisation", ancienne: existant.localisation, nouvelle: ligne.localisation });
      colonnesModifiees.push(ENTETE_NORMALISE_PAR_CLE.localisation);
      valeursAvant[ENTETE_NORMALISE_PAR_CLE.localisation] = existant.localisation;
    }
    if (ligne.groupe && ligne.groupe !== existant.groupe) {
      champsDiff.push({ label: "Groupe", ancienne: existant.groupe, nouvelle: ligne.groupe });
      colonnesModifiees.push(ENTETE_NORMALISE_PAR_CLE.groupe);
      valeursAvant[ENTETE_NORMALISE_PAR_CLE.groupe] = existant.groupe;
    }

    const champsConnus = new Set(type.champs_en_tete_supplementaires.map((c) => c.cle));
    // Comparaison non filtrée par `champsConnus` pour le rapport : un
    // champ qui diffère mais n'est pas déclaré dans le référentiel de
    // la famille n'est jamais appliqué (comportement inchangé), mais
    // doit quand même apparaître dans le rapport — c'est exactement le
    // type d'anomalie silencieuse qui a touché la famille Roof-top.
    for (const [cle, valeur] of Object.entries(ligne.champsEnTete)) {
      if (cle === "typeEquipement1") continue; // jamais lu du fichier, toujours fixe par la famille
      const ancienne = champsEnTeteExistantTexte[cle] ?? "";
      if (valeur === ancienne) continue;
      const entete = ENTETE_NORMALISE_PAR_CLE[cle] ?? cle;
      colonnesModifiees.push(entete);
      valeursAvant[entete] = ancienne;
      if (!champsConnus.has(cle)) continue;
      champsDiff.push({ label: CHAMPS_CONNUS_LABELS[cle] ?? cle, ancienne, nouvelle: valeur });
    }

    const champsEnTeteApres = { ...champsEnTeteExistantTexte, ...ligne.champsEnTete };

    if (champsDiff.length > 0) {
      modifications.push({ existant, ligne, champs: champsDiff });
      noter("modification", "", colonnesModifiees, valeursAvant, champsEnTeteApres);
    } else if (colonnesModifiees.length > 0) {
      noter(
        "modification",
        "Différences détectées mais non appliquées — champ(s) non configuré(s) sur la famille",
        colonnesModifiees,
        valeursAvant,
        champsEnTeteExistantTexte,
      );
    } else {
      noter("inchange", "", [], {}, champsEnTeteExistantTexte);
    }
  }

  const suppressions: DiffSuppression[] = [...existantsParNumero.entries()]
    .filter(([numero]) => !numerosVus.has(numero))
    .map(([, existant]) => ({ existant }));

  return { ajouts, modifications, suppressions, avertissements, toutesLesLignes, enTetes: [] };
}

/// Rattache chaque ligne importée au bon site parmi `sites` (un ou
/// plusieurs) exclusivement via ses colonnes Numéro Client/Site — sauf
/// cas particulier : un seul site fourni ET aucune ligne n'a ces
/// colonnes renseignées (fichier mono-site historique), auquel cas
/// tout lui est rattaché directement. Une ligne dont le Numéro est
/// illisible est signalée ; une ligne hors périmètre (autre site du
/// classeur partagé) est ignorée silencieusement. Port de
/// `EquipementImportService.calculerDiff`, généralisé à N sites (1 pour
/// un import par site, tous les sites d'un client, ou le parc entier).
export function calculerDiff(
  lignes: LigneImportEquipement[],
  sites: { id: string; n_affaire: string }[],
  existantsParSite: Map<string, Equipement[]>,
  typesById: Record<string, TypeEquipement>,
  enTetes: EnTeteSource[] = [],
): ResultatDiff {
  const auMoinsUneLigneAvecNumero = lignes.some(
    (l) => extraireNumero(l.numeroClientBrut) !== null && extraireNumero(l.numeroSiteBrut) !== null,
  );

  const lignesParSite = new Map<string, LigneImportEquipement[]>();
  const avertissementsGlobaux: Avertissement[] = [];

  if (sites.length === 1 && !auMoinsUneLigneAvecNumero) {
    lignesParSite.set(sites[0].id, lignes);
  } else {
    const siteParNumero = new Map<string, { id: string; n_affaire: string }>();
    for (const s of sites) {
      const cle = cleNumeroSite(s.n_affaire);
      if (cle) siteParNumero.set(cle, s);
    }
    for (const ligne of lignes) {
      const numClient = extraireNumero(ligne.numeroClientBrut);
      const numSite = extraireNumero(ligne.numeroSiteBrut);
      if (numClient === null || numSite === null) {
        avertissementsGlobaux.push({
          message: `Numéro Client/Site manquant ou illisible pour "${ligne.numeroEquipement || ligne.nom}" — ligne ignorée`,
        });
        continue;
      }
      const site = siteParNumero.get(`${numClient}-${numSite}`);
      // Hors périmètre de cet import (autre site du classeur partagé,
      // ex: "ToutSiteToutEquipement.xlsx" importé pour un seul site) —
      // pas une anomalie, et volontairement absent du rapport : ce
      // n'est pas une ligne de CET import.
      if (!site) continue;
      const liste = lignesParSite.get(site.id) ?? [];
      liste.push(ligne);
      lignesParSite.set(site.id, liste);
    }
  }

  const ajouts: DiffAjout[] = [];
  const modifications: DiffModification[] = [];
  const suppressions: DiffSuppression[] = [];
  const avertissements: Avertissement[] = [...avertissementsGlobaux];
  const toutesLesLignes: LigneAnalysee[] = [];

  for (const site of sites) {
    const resultat = calculerDiffPourSite(
      lignesParSite.get(site.id) ?? [],
      existantsParSite.get(site.id) ?? [],
      typesById,
      site.id,
    );
    ajouts.push(...resultat.ajouts);
    modifications.push(...resultat.modifications);
    suppressions.push(...resultat.suppressions);
    avertissements.push(...resultat.avertissements);
    toutesLesLignes.push(...resultat.toutesLesLignes);
  }

  return { ajouts, modifications, suppressions, avertissements, toutesLesLignes, enTetes };
}

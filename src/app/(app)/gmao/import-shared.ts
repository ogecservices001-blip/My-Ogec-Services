"use server";

import ExcelJS from "exceljs";
import { valeurSimpleCellule } from "@/lib/excel-import";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement, ReferenceHoraire, ChampsEnTeteEquipement } from "@/lib/gmao/types";
import {
  calculerDiff,
  CHAMPS_CONNUS_LABELS,
  type LigneImportEquipement,
  type ResultatDiff,
} from "@/lib/gmao/equipement-import";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { heuresCumulAnnee } from "@/lib/gmao/calcul-heures-visite";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";
import type { ActionResult } from "@/lib/action-result";
import { finaliserFeuille } from "@/lib/excel-export";

/// Logique d'import "Sommaire" partagée entre l'import par site
/// (/gmao/clients/[id]/equipements/importer), par client
/// (/gmao/clients/groupe/[nom]/importer) et global (/gmao/importer) —
/// seul le nombre de sites fournis change, le rattachement par Numéro
/// Client/Site (calculerDiff) gère les trois cas de façon uniforme.

const COLONNE_VERS_CLE: Record<string, string> = {
  "type equipement 2": "typeEquipement2",
  "type equipement 3": "typeEquipement3",
  marque: "marque",
  "date m.e.s.": "dateMES",
  "référence unité intérieure": "referenceUInt",
  "référence unité extérieure": "referenceUExt",
  "numéro série unité intérieure": "numSerieUInt",
  "numéro série unité extérieure": "numSerieUExt",
  "date interv prévue": "dateIntervPrevue",
  "nom tech": "nomTech",
  "réfrigérant": "typeRefrigerant",
  "charge réfrigérant kg": "chargeRefrigerant",
  "tension alim.": "tensionAlim",
  puissance: "puissance",
  "fréquence entretien annuelle": "freqEntretienAnnuelle",
  "date dernier contrôle étanchéité": "dateDernierControle",
  "date prochain contrôle étanchéité": "dateProchainControle",
  "n° dernier bordereau étanchéité": "numDernierBordereau",
  "date dernier contrôle désenfumage": "dateDernierControleDesenfumage",
  "date prochain contrôle désenfumage": "dateProchainControleDesenfumage",
};

function normaliser(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

async function parserSommaire(fichier: File): Promise<LigneImportEquipement[] | null> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fichier.arrayBuffer());

  const feuille = workbook.getWorksheet("Sommaire") ?? workbook.worksheets[0];
  if (!feuille) return null;

  const indexParCle = new Map<string, number>();
  feuille.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const texte = normaliser(String(cell.value ?? ""));
    if (texte) indexParCle.set(texte, colNumber);
  });

  const valeur = (row: ExcelJS.Row, enteteNormalise: string): string => {
    const col = indexParCle.get(enteteNormalise);
    if (!col) return "";
    const v = valeurSimpleCellule(row.getCell(col).value);
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return `${deuxChiffres(v.getUTCDate())}/${deuxChiffres(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
    if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
    return String(v).trim();
  };

  const lignes: LigneImportEquipement[] = [];
  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return;

    const nom = valeur(row, "nom equipements");
    if (!nom) return;

    const typeDeReleveBrut = valeur(row, "type de relevé");
    const typeEquipementId = typeDeReleveBrut
      ? typeDeReleveBrut.trim().toLowerCase().replace(/\s+/g, "_")
      : null;

    const champsEnTete: Record<string, string> = {};
    for (const [entete, cle] of Object.entries(COLONNE_VERS_CLE)) {
      const v = valeur(row, entete);
      if (v) champsEnTete[cle] = v;
    }

    lignes.push({
      nom,
      numeroEquipement: valeur(row, "numéro équipement"),
      localisation: valeur(row, "localisation"),
      groupe: valeur(row, "groupe"),
      informationsInternes: valeur(row, "informations internes"),
      remarquesTechniciens: valeur(row, "remarques techniciens"),
      typeDeReleveBrut,
      typeEquipementId,
      champsEnTete,
      numeroClientBrut: valeur(row, "numéro client"),
      numeroSiteBrut: valeur(row, "numéro site"),
    });
  });

  return lignes;
}

/// Ce que l'écran affiche : compteurs, 300 premières lignes de chaque
/// catégorie, avertissements. L'analyse complète ne quitte jamais le
/// serveur (Vercel refuse tout échange de plus de 4,5 Mo) : le fichier
/// est renvoyé à l'application et au rapport, et réanalysé à l'identique.
const LIMITE_APERCU = 300;

export type ApercuImport = {
  empreinte: string;
  nbAjouts: number;
  nbModifications: number;
  nbSuppressions: number;
  ajouts: { nom: string; sousTitre: string }[];
  modifications: { nom: string; sousTitre: string }[];
  suppressions: { nom: string; sousTitre: string }[];
  avertissements: string[];
};

export type ChoixImport = {
  ajoutsDecoches: number[];
  modificationsDecochees: number[];
  suppressionsCochees: number[];
};

export type ResultatPreviewEquipements = { ok: true; apercu: ApercuImport } | { ok: false; erreur: string };

async function analyserFichier(siteIds: string[], formData: FormData): Promise<{ ok: true; diff: ResultatDiff } | { ok: false; erreur: string }> {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  let lignes: LigneImportEquipement[] | null;
  try {
    lignes = await parserSommaire(fichier);
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx/.xlsm est attendu." };
  }
  if (!lignes) return { ok: false, erreur: "Classeur vide." };

  const supabase = await createClient();
  const { data: sites, error: errSites } = await supabase
    .from("sites")
    .select("id, n_affaire")
    .in("id", siteIds);
  if (errSites || !sites || sites.length === 0) return { ok: false, erreur: "Site(s) introuvable(s)." };

  let existants: Equipement[];
  const { data: types } = await supabase.from("types_equipement").select("*");
  try {
    existants = await recupererToutesLesLignes<Equipement>((debut, fin) =>
      supabase.from("equipements").select("*").in("site_id", siteIds).range(debut, fin),
    );
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }

  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const existantsParSite = new Map<string, Equipement[]>();
  for (const e of existants) {
    const liste = existantsParSite.get(e.site_id) ?? [];
    liste.push(e);
    existantsParSite.set(e.site_id, liste);
  }

  return { ok: true, diff: calculerDiff(lignes, sites, existantsParSite, typesById) };
}

/// Signature de l'analyse : si le parc ou le fichier a changé entre
/// l'aperçu et l'application, on refuse d'appliquer.
function empreinteDiff(diff: ResultatDiff): string {
  const contenu = JSON.stringify([
    diff.ajouts.map((a) => [a.siteId, a.ligne.numeroEquipement]),
    diff.modifications.map((m) => [m.existant.id, m.existant.updated_at, m.champs]),
    diff.suppressions.map((x) => [x.existant.id, x.existant.updated_at]),
  ]);
  return createHash("sha256").update(contenu).digest("hex");
}

/// Analyse le classeur "Sommaire" pour les sites donnés (un, tous ceux
/// d'un client, ou le parc entier) — port de `calculerDiff`
/// (equipement_import_service.dart).
export async function previsualiserImportEquipements(siteIds: string[], formData: FormData): Promise<ResultatPreviewEquipements> {
  await requireAdmin();
  const res = await analyserFichier(siteIds, formData);
  if (!res.ok) return res;
  const { diff } = res;
  return {
    ok: true,
    apercu: {
      empreinte: empreinteDiff(diff),
      nbAjouts: diff.ajouts.length,
      nbModifications: diff.modifications.length,
      nbSuppressions: diff.suppressions.length,
      ajouts: diff.ajouts.slice(0, LIMITE_APERCU).map((a) => ({
        nom: a.ligne.nom,
        sousTitre: [a.ligne.typeDeReleveBrut, a.ligne.numeroEquipement, a.ligne.localisation].filter(Boolean).join(" — "),
      })),
      modifications: diff.modifications.slice(0, LIMITE_APERCU).map((m) => ({
        nom: m.existant.nom,
        sousTitre: m.champs.map((c) => `${c.label} : "${c.ancienne}" → "${c.nouvelle}"`).join("\n"),
      })),
      suppressions: diff.suppressions.slice(0, LIMITE_APERCU).map((x) => ({
        nom: x.existant.nom,
        sousTitre: `Absent du fichier importé — ${x.existant.numero_equipement}`,
      })),
      avertissements: diff.avertissements.map((a) => a.message),
    },
  };
}

/// Applique les lignes cochées : le fichier est réanalysé à l'identique
/// (empreinte vérifiée), puis le rapport est produit sur cette même
/// analyse avant écriture.
export async function appliquerImportEquipements(
  siteIds: string[],
  formData: FormData,
  choix: ChoixImport,
  empreinte: string,
  cheminsARevalider: string[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number; supprimes?: number; rapport?: string }> {
  await requireAdmin();
  const res = await analyserFichier(siteIds, formData);
  if (!res.ok) return res;
  const { diff } = res;
  if (empreinteDiff(diff) !== empreinte) {
    return { ok: false, erreur: "Le parc ou le fichier a changé depuis l'analyse : relance l'analyse avant d'appliquer." };
  }
  const ajoutsDecoches = new Set(choix.ajoutsDecoches);
  const modificationsDecochees = new Set(choix.modificationsDecochees);
  const suppressionsCochees = new Set(choix.suppressionsCochees);

  const supabase = await createClient();
  const rapport = await rapportDepuisDiff(supabase, diff);
  let ajoutes = 0;
  let modifies = 0;
  let supprimes = 0;

  const aInserer = diff.ajouts
    .filter((_, i) => !ajoutsDecoches.has(i))
    .map((a) => ({
      site_id: a.siteId,
      type_equipement_id: a.ligne.typeEquipementId!,
      nom: a.ligne.nom,
      numero_equipement: a.ligne.numeroEquipement,
      localisation: a.ligne.localisation,
      groupe: a.ligne.groupe,
      informations_internes: a.ligne.informationsInternes,
      remarques_techniciens: a.ligne.remarquesTechniciens,
      champs_en_tete: a.ligne.champsEnTete,
    }));
  const TAILLE_LOT = 500;
  for (let i = 0; i < aInserer.length; i += TAILLE_LOT) {
    const lot = aInserer.slice(i, i + TAILLE_LOT);
    const { error } = await supabase.from("equipements").insert(lot);
    if (error) return { ok: false, erreur: `${error.message} (lignes ${ajoutes + 1} à ${ajoutes + lot.length})` };
    ajoutes += lot.length;
  }

  const aModifier = diff.modifications.filter((_, i) => !modificationsDecochees.has(i));
  const EN_PARALLELE = 20;
  for (let i = 0; i < aModifier.length; i += EN_PARALLELE) {
    const resultats = await Promise.all(
      aModifier.slice(i, i + EN_PARALLELE).map((mod) =>
        supabase
          .from("equipements")
          .update({
            nom: mod.ligne.nom || mod.existant.nom,
            localisation: mod.ligne.localisation || mod.existant.localisation,
            groupe: mod.ligne.groupe || mod.existant.groupe,
            informations_internes: mod.ligne.informationsInternes || mod.existant.informations_internes,
            remarques_techniciens: mod.ligne.remarquesTechniciens || mod.existant.remarques_techniciens,
            champs_en_tete: { ...mod.existant.champs_en_tete, ...mod.ligne.champsEnTete },
          })
          .eq("id", mod.existant.id),
      ),
    );
    const echec = resultats.find((r) => r.error);
    if (echec?.error) return { ok: false, erreur: `${echec.error.message} (après ${ajoutes} ajout(s) et ${modifies} modification(s))` };
    modifies += resultats.length;
  }

  const aSupprimer = diff.suppressions.filter((_, i) => suppressionsCochees.has(i)).map((x) => x.existant.id);
  for (let i = 0; i < aSupprimer.length; i += TAILLE_LOT) {
    const lot = aSupprimer.slice(i, i + TAILLE_LOT);
    const { error } = await supabase.from("equipements").delete().in("id", lot);
    if (error) return { ok: false, erreur: error.message };
    supprimes += lot.length;
  }

  for (const chemin of cheminsARevalider) revalidatePath(chemin);
  return { ok: true, ajoutes, modifies, supprimes, rapport };
}

/// Rapport de l'analyse en cours, depuis le fichier renvoyé (même analyse
/// que l'aperçu).
export async function genererRapportImportEquipements(siteIds: string[], formData: FormData): Promise<ActionResult & { base64?: string }> {
  await requireAdmin();
  const res = await analyserFichier(siteIds, formData);
  if (!res.ok) return res;
  return { ok: true, base64: await rapportDepuisDiff(await createClient(), res.diff) };
}

/// Calcule les heures Tech/Assistant par an d'une ligne (ajout ou
/// modification) depuis le catalogue Référentiel Heures + sa Fréquence
/// entretien annuelle. `champsEnTete` doit déjà être la version "après
/// import" (fusionnée avec l'existant pour une modification).
function calculerHeuresLigne(
  champsEnTete: Record<string, string>,
  references: ReferenceHoraire[],
): { heuresTech: string; heuresAssistant: string; statut: string } {
  const resultat = analyserReference(champsEnTete as ChampsEnTeteEquipement, references);
  const freqBrut = champsEnTete.freqEntretienAnnuelle;
  const freq = typeof freqBrut === "string" ? parseInt(freqBrut, 10) : NaN;

  if (!resultat.reference) {
    return {
      heuresTech: "",
      heuresAssistant: "",
      statut: resultat.horsCatalogue
        ? "Anomalie — taille non répertoriée dans le catalogue"
        : "Anomalie — famille absente du catalogue d'heures",
    };
  }
  if (!Number.isFinite(freq) || freq <= 0) {
    return { heuresTech: "", heuresAssistant: "", statut: "Anomalie — Fréquence entretien annuelle manquante" };
  }
  const cumul = heuresCumulAnnee(freq, resultat.reference);
  if (!cumul) {
    return { heuresTech: "", heuresAssistant: "", statut: `Anomalie — fréquence ${freq}x/an non gérée` };
  }
  return {
    heuresTech: String(cumul.heuresTech),
    heuresAssistant: String(cumul.heuresAssistant),
    statut: resultat.approchee ? "OK (taille approchée)" : "OK",
  };
}

/// Rapport .xlsx de l'import analysé — scopé aux seuls équipements
/// ajoutés ou modifiés par CET import (jamais le reste du classeur
/// pour d'autres clients, ni les lignes inchangées du site) :
/// - équipement pas encore en GMAO → ligne entière en rouge ;
/// - équipement existant dont une valeur a changé → cellule en rouge,
///   affichant "nouvelle valeur (était : ancienne valeur)" ;
/// - heures Tech/Assistant par an affectées à chaque équipement,
///   recalculées depuis le catalogue Référentiel Heures.
async function rapportDepuisDiff(supabase: Awaited<ReturnType<typeof createClient>>, diff: ResultatDiff): Promise<string> {

  const { data: types } = await supabase.from("types_equipement").select("*");
  const { data: references } = await supabase.from("references_horaires").select("*");
  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const siteIds = new Set<string>();
  for (const a of diff.ajouts) siteIds.add(a.siteId);
  for (const m of diff.modifications) siteIds.add(m.existant.site_id);
  const { data: sites } = await supabase.from("sites").select("id, nom, n_affaire").in("id", [...siteIds]);
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const nomSite = (id: string) => {
    const s = siteParId.get(id);
    return s ? `${s.nom} (${s.n_affaire})` : id;
  };
  const nomFamille = (ligne: LigneImportEquipement) => typesById[ligne.typeEquipementId ?? ""]?.nom ?? ligne.typeDeReleveBrut;

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Rapport d'import");

  const champsOrdre = Object.keys(CHAMPS_CONNUS_LABELS);
  feuille.addRow([
    "Résultat",
    "Site",
    "Famille",
    "Nom",
    "Numéro équipement",
    "Localisation",
    "Groupe",
    "Informations internes",
    "Remarques techniciens",
    ...champsOrdre.map((cle) => CHAMPS_CONNUS_LABELS[cle]),
    "Heures Tech / an",
    "Heures Assistant / an",
    "Statut heures",
  ]);
  const premiereColonneChamps = 10;
  const colonneStatutHeures = premiereColonneChamps + champsOrdre.length + 2;
  const ROUGE = { color: { argb: "FFCC0000" }, bold: true };

  for (const a of diff.ajouts) {
    const heures = calculerHeuresLigne(a.ligne.champsEnTete, (references ?? []) as ReferenceHoraire[]);
    const ligneAjoutee = feuille.addRow([
      "Nouvel équipement",
      nomSite(a.siteId),
      nomFamille(a.ligne),
      a.ligne.nom,
      a.ligne.numeroEquipement,
      a.ligne.localisation,
      a.ligne.groupe,
      a.ligne.informationsInternes,
      a.ligne.remarquesTechniciens,
      ...champsOrdre.map((cle) => a.ligne.champsEnTete[cle] ?? ""),
      heures.heuresTech,
      heures.heuresAssistant,
      heures.statut,
    ]);
    ligneAjoutee.eachCell((cellule) => (cellule.font = ROUGE));
  }

  for (const m of diff.modifications) {
    const champsApres = { ...m.existant.champs_en_tete, ...m.ligne.champsEnTete } as Record<string, string>;
    const champsModifies = new Set(m.champs.map((c) => c.label));
    const valeurAvantParLabel = new Map(m.champs.map((c) => [c.label, c.ancienne] as const));
    const heures = calculerHeuresLigne(champsApres, (references ?? []) as ReferenceHoraire[]);

    const texteModifie = (label: string, apres: string) =>
      champsModifies.has(label) ? `${apres} (était : ${valeurAvantParLabel.get(label) || "vide"})` : apres;
    const valeursChamps = champsOrdre.map((cle) => {
      const label = CHAMPS_CONNUS_LABELS[cle];
      const apres = champsApres[cle] ?? "";
      if (champsModifies.has(label)) {
        const avant = valeurAvantParLabel.get(label) ?? "";
        return `${apres} (était : ${avant || "vide"})`;
      }
      return apres;
    });

    const ligneAjoutee = feuille.addRow([
      "Modifié",
      nomSite(m.existant.site_id),
      nomFamille(m.ligne),
      m.ligne.nom || m.existant.nom,
      m.existant.numero_equipement,
      m.ligne.localisation || m.existant.localisation,
      m.ligne.groupe || m.existant.groupe,
      texteModifie("Informations internes", m.ligne.informationsInternes || m.existant.informations_internes),
      texteModifie("Remarques techniciens", m.ligne.remarquesTechniciens || m.existant.remarques_techniciens),
      ...valeursChamps,
      heures.heuresTech,
      heures.heuresAssistant,
      heures.statut,
    ]);
    if (champsModifies.has("Informations internes")) ligneAjoutee.getCell(premiereColonneChamps - 2).font = ROUGE;
    if (champsModifies.has("Remarques techniciens")) ligneAjoutee.getCell(premiereColonneChamps - 1).font = ROUGE;
    champsOrdre.forEach((cle, i) => {
      if (champsModifies.has(CHAMPS_CONNUS_LABELS[cle])) {
        ligneAjoutee.getCell(premiereColonneChamps + i).font = ROUGE;
      }
    });
    if (heures.statut.startsWith("Anomalie")) {
      ligneAjoutee.getCell(colonneStatutHeures).font = ROUGE;
    }
  }

  if (diff.avertissements.length > 0) {
    const feuilleAvert = workbook.addWorksheet("Avertissements");
    feuilleAvert.addRow(["Message"]);
    for (const av of diff.avertissements) feuilleAvert.addRow([av.message]);
    finaliserFeuille(feuilleAvert);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement, ReferenceHoraire, ChampsEnTeteEquipement } from "@/lib/gmao/types";
import {
  calculerDiff,
  type LigneImportEquipement,
  type ResultatDiff,
  type EnTeteSource,
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
  "date dernier contrôle": "dateDernierControle",
  "date prochain contrôle": "dateProchainControle",
  "n° dernier bordereau": "numDernierBordereau",
};

function normaliser(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

async function parserSommaire(
  fichier: File,
): Promise<{ lignes: LigneImportEquipement[]; enTetes: EnTeteSource[] } | null> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fichier.arrayBuffer());

  const feuille = workbook.getWorksheet("Sommaire") ?? workbook.worksheets[0];
  if (!feuille) return null;

  const indexParCle = new Map<string, number>();
  const enTetes: EnTeteSource[] = [];
  feuille.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const original = String(cell.value ?? "").trim();
    const texte = normaliser(original);
    if (texte) {
      indexParCle.set(texte, colNumber);
      enTetes.push({ normalise: texte, original: original || texte });
    }
  });

  const valeur = (row: ExcelJS.Row, enteteNormalise: string): string => {
    const col = indexParCle.get(enteteNormalise);
    if (!col) return "";
    const v = row.getCell(col).value;
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

    // Toutes les colonnes du fichier, y compris celles qu'on n'importe
    // pas (ex: "Informations complémentaires") — pour que le rapport
    // puisse réafficher la ligne telle quelle.
    const colonnesBrutes: Record<string, string> = {};
    for (const { normalise } of enTetes) colonnesBrutes[normalise] = valeur(row, normalise);

    lignes.push({
      numeroLigne,
      nom,
      numeroEquipement: valeur(row, "numéro équipement"),
      localisation: valeur(row, "localisation"),
      groupe: valeur(row, "groupe"),
      typeDeReleveBrut,
      typeEquipementId,
      champsEnTete,
      numeroClientBrut: valeur(row, "numéro client"),
      numeroSiteBrut: valeur(row, "numéro site"),
      colonnesBrutes,
    });
  });

  return { lignes, enTetes };
}

export type ResultatPreviewEquipements =
  | { ok: true; diff: ResultatDiff }
  | { ok: false; erreur: string };

/// Analyse le classeur "Sommaire" pour les sites donnés (un, tous ceux
/// d'un client, ou le parc entier) — port de `calculerDiff`
/// (equipement_import_service.dart).
export async function previsualiserImportEquipements(
  siteIds: string[],
  formData: FormData,
): Promise<ResultatPreviewEquipements> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  let parse: { lignes: LigneImportEquipement[]; enTetes: EnTeteSource[] } | null;
  try {
    parse = await parserSommaire(fichier);
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx/.xlsm est attendu." };
  }
  if (!parse) return { ok: false, erreur: "Classeur vide." };
  const { lignes, enTetes } = parse;

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

  const diff = calculerDiff(lignes, sites, existantsParSite, typesById, enTetes);
  return { ok: true, diff };
}

/// Applique les lignes cochées (déjà rattachées à leur site via
/// `DiffAjout.siteId` / `DiffModification.existant.site_id`) — jamais
/// un nouveau parsing du fichier.
export async function appliquerImportEquipements(
  diff: ResultatDiff,
  selection: { ajouts: boolean[]; modifications: boolean[]; suppressions: boolean[] },
  cheminsARevalider: string[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number; supprimes?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;
  let supprimes = 0;

  const aInserer = diff.ajouts
    .filter((_, i) => selection.ajouts[i])
    .map((a) => ({
      site_id: a.siteId,
      type_equipement_id: a.ligne.typeEquipementId!,
      nom: a.ligne.nom,
      numero_equipement: a.ligne.numeroEquipement,
      localisation: a.ligne.localisation,
      groupe: a.ligne.groupe,
      champs_en_tete: a.ligne.champsEnTete,
    }));
  // Insert par lots : un envoi unique de plusieurs milliers de lignes
  // (import "tous clients") peut dépasser la taille de requête acceptée
  // et fait échouer tout le lot d'un coup.
  const TAILLE_LOT = 500;
  for (let i = 0; i < aInserer.length; i += TAILLE_LOT) {
    const lot = aInserer.slice(i, i + TAILLE_LOT);
    const { error } = await supabase.from("equipements").insert(lot);
    if (error) return { ok: false, erreur: `${error.message} (lignes ${ajoutes + 1} à ${ajoutes + lot.length})` };
    ajoutes += lot.length;
  }

  for (let i = 0; i < diff.modifications.length; i++) {
    if (!selection.modifications[i]) continue;
    const mod = diff.modifications[i];
    const champsEnTeteFusionnes = { ...mod.existant.champs_en_tete, ...mod.ligne.champsEnTete };
    const { error } = await supabase
      .from("equipements")
      .update({
        nom: mod.ligne.nom || mod.existant.nom,
        localisation: mod.ligne.localisation || mod.existant.localisation,
        groupe: mod.ligne.groupe || mod.existant.groupe,
        champs_en_tete: champsEnTeteFusionnes,
      })
      .eq("id", mod.existant.id);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  for (let i = 0; i < diff.suppressions.length; i++) {
    if (!selection.suppressions[i]) continue;
    const { error } = await supabase.from("equipements").delete().eq("id", diff.suppressions[i].existant.id);
    if (error) return { ok: false, erreur: error.message };
    supprimes++;
  }

  for (const chemin of cheminsARevalider) revalidatePath(chemin);
  return { ok: true, ajoutes, modifies, supprimes };
}

/// Rapport .xlsx de l'import analysé (diff déjà calculé côté client,
/// jamais un nouveau parsing du fichier) — un seul tableau, scopé aux
/// seuls équipements de CET import (jamais le reste du classeur pour
/// d'autres clients) :
/// - mêmes colonnes que le fichier source ;
/// - équipement pas encore en GMAO → ligne entière en rouge ;
/// - équipement existant dont une valeur a changé → cellule en rouge,
///   affichant "nouvelle valeur (était : ancienne valeur)" ;
/// - heures Tech/Assistant par an affectées à chaque équipement,
///   recalculées depuis le catalogue Référentiel Heures.
export async function genererRapportImportEquipements(diff: ResultatDiff): Promise<ActionResult & { base64?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: types } = await supabase.from("types_equipement").select("*");
  const { data: references } = await supabase.from("references_horaires").select("*");
  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const siteIds = new Set<string>();
  for (const l of diff.toutesLesLignes) if (l.siteId) siteIds.add(l.siteId);
  const { data: sites } = await supabase.from("sites").select("id, nom, n_affaire").in("id", [...siteIds]);
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const nomSite = (id: string | null) => {
    const s = id ? siteParId.get(id) : undefined;
    return s ? `${s.nom} (${s.n_affaire})` : "";
  };

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Rapport d'import");

  const entetes = diff.enTetes;
  const libellesEntetes = entetes.map((e) => e.original);
  feuille.addRow([
    "Site",
    ...libellesEntetes,
    "Heures Tech / an",
    "Heures Assistant / an",
    "Statut heures",
    "Résultat",
    "Raison",
  ]);
  const colonneSite = 1;
  const colonneStatutHeures = entetes.length + 4;

  const STATUT_LABEL: Record<string, string> = {
    ajout: "Nouvel équipement",
    modification: "Modifié",
    inchange: "Inchangé",
    ignoree: "Ignoré",
  };
  const ROUGE = { color: { argb: "FFCC0000" }, bold: true };

  for (const l of diff.toutesLesLignes) {
    const resultat = analyserReference(l.champsEnTeteApres as ChampsEnTeteEquipement, (references ?? []) as ReferenceHoraire[]);
    const freqBrut = l.champsEnTeteApres.freqEntretienAnnuelle;
    const freq = typeof freqBrut === "string" ? parseInt(freqBrut, 10) : NaN;

    let heuresTech = "";
    let heuresAssistant = "";
    let statutHeures = "";
    if (l.statut !== "ignoree") {
      if (!resultat.reference) {
        statutHeures = resultat.horsCatalogue
          ? "Anomalie — taille non répertoriée dans le catalogue"
          : "Anomalie — famille absente du catalogue d'heures";
      } else if (!Number.isFinite(freq) || freq <= 0) {
        statutHeures = "Anomalie — Fréquence entretien annuelle manquante";
      } else {
        const cumul = heuresCumulAnnee(freq, resultat.reference);
        if (!cumul) {
          statutHeures = `Anomalie — fréquence ${freq}x/an non gérée`;
        } else {
          heuresTech = String(cumul.heuresTech);
          heuresAssistant = String(cumul.heuresAssistant);
          statutHeures = resultat.approchee ? "OK (taille approchée)" : "OK";
        }
      }
    }

    const valeurs = entetes.map((e) => {
      const apres = l.colonnesBrutes[e.normalise] ?? "";
      if (l.colonnesModifiees.includes(e.normalise)) {
        const avant = l.valeursAvant[e.normalise];
        return `${apres} (était : ${avant || "vide"})`;
      }
      return apres;
    });

    const ligneAjoutee = feuille.addRow([
      nomSite(l.siteId),
      ...valeurs,
      heuresTech,
      heuresAssistant,
      statutHeures,
      STATUT_LABEL[l.statut],
      l.raison,
    ]);

    if (l.statut === "ajout") {
      ligneAjoutee.eachCell((cellule) => (cellule.font = ROUGE));
    } else if (l.statut === "ignoree") {
      ligneAjoutee.eachCell((cellule) => {
        cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
        cellule.font = { color: { argb: "FF888888" } };
      });
    } else if (l.statut === "modification") {
      entetes.forEach((e, i) => {
        if (l.colonnesModifiees.includes(e.normalise)) {
          ligneAjoutee.getCell(colonneSite + 1 + i).font = ROUGE;
        }
      });
    }
    if (statutHeures.startsWith("Anomalie")) {
      ligneAjoutee.getCell(colonneStatutHeures).font = ROUGE;
    }
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return { ok: true, base64: Buffer.from(buffer).toString("base64") };
}

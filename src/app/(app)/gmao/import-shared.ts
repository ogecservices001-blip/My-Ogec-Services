"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement } from "@/lib/gmao/types";
import { calculerDiff, type LigneImportEquipement, type ResultatDiff } from "@/lib/gmao/equipement-import";
import type { ActionResult } from "@/lib/action-result";

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

    lignes.push({
      nom,
      numeroEquipement: valeur(row, "numéro équipement"),
      localisation: valeur(row, "localisation"),
      groupe: valeur(row, "groupe"),
      typeDeReleveBrut,
      typeEquipementId,
      champsEnTete,
      numeroClientBrut: valeur(row, "numéro client"),
      numeroSiteBrut: valeur(row, "numéro site"),
    });
  });

  return lignes;
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

  const [{ data: existants, error: errExistants }, { data: types }] = await Promise.all([
    supabase.from("equipements").select("*").in("site_id", siteIds),
    supabase.from("types_equipement").select("*"),
  ]);
  if (errExistants) return { ok: false, erreur: errExistants.message };

  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const existantsParSite = new Map<string, Equipement[]>();
  for (const e of (existants ?? []) as Equipement[]) {
    const liste = existantsParSite.get(e.site_id) ?? [];
    liste.push(e);
    existantsParSite.set(e.site_id, liste);
  }

  const diff = calculerDiff(lignes, sites, existantsParSite, typesById);
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
  if (aInserer.length > 0) {
    const { error } = await supabase.from("equipements").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
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

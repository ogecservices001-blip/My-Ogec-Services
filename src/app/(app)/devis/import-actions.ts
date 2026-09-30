"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import type { DevisInput } from "./actions";

export type LigneDevisImport = {
  donnees: DevisInput;
  siteId: string;
  clientNom: string;
  clientSite: string;
  /// true si le fichier ne précise aucun site connu (N°Site "0" —
  /// devis au niveau client) et que la ligne a été rattachée au
  /// premier site connu du client faute de mieux.
  siteApproximatif: boolean;
  devisExistantId: string | null;
};

export type ResultatPreviewDevis =
  | { ok: true; lignes: LigneDevisImport[]; avertissements: string[] }
  | { ok: false; erreur: string };

function texteCell(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  }
  if (typeof v === "object" && "result" in v) return texteCell(v.result as ExcelJS.CellValue);
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
  return String(v).trim();
}

function cell(row: ExcelJS.Row, index: number): string {
  return texteCell(row.getCell(index).value);
}

function entierCell(row: ExcelJS.Row, index: number): number | null {
  const s = cell(row, index);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function nombreCell(row: ExcelJS.Row, index: number): number | null {
  const s = cell(row, index);
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/// Lit la feuille "Suivi Devis" du classeur "Chono Devis OGS 2026.xlsm"
/// — colonnes fixes lues par position (voir migration 0019 pour le
/// mapping complet), classeur distinct du "Base clients" (celui-ci ne
/// fait que reprendre la référence devis déjà générée ici).
export async function previsualiserImportDevis(formData: FormData): Promise<ResultatPreviewDevis> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await fichier.arrayBuffer());
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx/.xlsm est attendu." };
  }

  const feuille = workbook.getWorksheet("Suivi Devis") ?? workbook.worksheets[0];
  if (!feuille || feuille.rowCount === 0) {
    return { ok: false, erreur: "Feuille introuvable ou vide dans ce classeur." };
  }

  const supabase = await createClient();
  const [{ data: sites, error: errSites }, { data: devisExistants, error: errDevis }] = await Promise.all([
    supabase.from("sites").select("id, nom, site, n_affaire, courriel_responsable"),
    supabase.from("devis").select("id, numero"),
  ]);
  if (errSites) return { ok: false, erreur: errSites.message };
  if (errDevis) return { ok: false, erreur: errDevis.message };

  type SiteResume = { id: string; nom: string; site: string; courriel_responsable: string };
  const siteParCle = new Map<string, SiteResume>();
  const premierSiteParNumClient = new Map<number, { numSite: number; site: SiteResume }>();
  for (const s of sites ?? []) {
    const parts = s.n_affaire.split("-");
    if (parts.length !== 2) continue;
    const numClient = parseInt(parts[0].trim(), 10);
    const numSite = parseInt(parts[1].trim(), 10);
    if (Number.isNaN(numClient) || Number.isNaN(numSite)) continue;
    siteParCle.set(`${numClient}-${numSite}`, s);
    const existant = premierSiteParNumClient.get(numClient);
    if (!existant || numSite < existant.numSite) premierSiteParNumClient.set(numClient, { numSite, site: s });
  }

  const devisParNumero = new Map((devisExistants ?? []).map((d) => [d.numero, d.id]));

  const lignes: LigneDevisImport[] = [];
  const avertissements: string[] = [];

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return; // en-tête
    const item = cell(row, 1);
    if (!item) return;

    const numero = cell(row, 7);
    const numClient = entierCell(row, 3);
    const numSite = entierCell(row, 4);
    if (numClient === null || numSite === null) {
      avertissements.push(`Ligne ${numeroLigne} (item "${item}") ignorée : N° Client/Site illisible.`);
      return;
    }

    let site = siteParCle.get(`${numClient}-${numSite}`);
    let siteApproximatif = false;
    if (!site && numSite === 0) {
      const repli = premierSiteParNumClient.get(numClient);
      if (repli) {
        site = repli.site;
        siteApproximatif = true;
      }
    }
    if (!site) {
      avertissements.push(`Client ${numClient}-${numSite} introuvable dans le Répertoire (item "${item}") — ligne ignorée.`);
      return;
    }

    const natureBrute = cell(row, 5);
    const nature = /^\d+$/.test(natureBrute) ? natureBrute : "";

    lignes.push({
      donnees: {
        numero,
        item,
        redacteur: cell(row, 2),
        nature,
        date_devis: cell(row, 6),
        libelle: cell(row, 10),
        montant: nombreCell(row, 11),
        date_commande_client: cell(row, 12),
        reference_client: cell(row, 13),
        statut_commande_fournisseur: cell(row, 14),
        date_mise_a_disposition_fourniture: cell(row, 15),
        numero_facture: cell(row, 16),
        mois_facturation: cell(row, 17),
        remarques: cell(row, 18),
        debours_materiel_prevu: nombreCell(row, 19),
        heures_prevues: nombreCell(row, 20),
        email_responsable_contrat: site.courriel_responsable,
      },
      siteId: site.id,
      clientNom: site.nom,
      clientSite: site.site,
      siteApproximatif,
      devisExistantId: numero ? (devisParNumero.get(numero) ?? null) : null,
    });
  });

  return { ok: true, lignes, avertissements };
}

export async function appliquerImportDevis(
  lignes: LigneDevisImport[],
): Promise<ActionResult & { crees?: number; misesAJour?: number }> {
  await requireAdmin();
  const supabase = await createClient();

  let crees = 0;
  let misesAJour = 0;

  for (const ligne of lignes) {
    const donnees = { ...ligne.donnees, site_id: ligne.siteId };
    if (ligne.devisExistantId) {
      const { error } = await supabase
        .from("devis")
        .update({ ...donnees, updated_at: new Date().toISOString() })
        .eq("id", ligne.devisExistantId);
      if (error) return { ok: false, erreur: error.message, crees, misesAJour };
      misesAJour++;
    } else {
      const { error } = await supabase.from("devis").insert(donnees);
      if (error) return { ok: false, erreur: error.message, crees, misesAJour };
      crees++;
    }
  }

  revalidatePath("/devis");
  revalidatePath("/prestations");
  return { ok: true, crees, misesAJour };
}

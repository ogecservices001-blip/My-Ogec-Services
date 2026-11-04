"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { NATURE_DEVIS } from "@/lib/devis/constants";
import type { DevisInput } from "./actions";

const CODE_PAR_LABEL_NATURE = new Map(Object.entries(NATURE_DEVIS).map(([code, label]) => [label, code]));

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
  if (index <= 0) return ""; // colonne absente du fichier (en-tête non trouvé)
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

/// Colonnes attendues, par en-tête (ligne 1) — même format que notre
/// propre export (/devis/export), pour pouvoir exporter, corriger dans
/// Excel puis réimporter. Lu par nom plutôt que par position : un
/// classeur réimporté après avoir été retouché (colonnes réordonnées,
/// certaines supprimées) reste exploitable tant que les en-têtes
/// voulus sont présents.
const COLONNE_REFERENCE = "Référence devis";
const COLONNE_NUM_CLIENT = "Numéro Client";
const COLONNE_NUM_SITE = "N° Site";

function entetesColonnes(feuille: ExcelJS.Worksheet): Map<string, number> {
  const entetes = new Map<string, number>();
  const ligneEntete = feuille.getRow(1);
  ligneEntete.eachCell((cellule, index) => {
    const texte = texteCell(cellule.value);
    if (texte) entetes.set(texte, index);
  });
  return entetes;
}

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

  const feuille = workbook.worksheets[0];
  if (!feuille || feuille.rowCount === 0) {
    return { ok: false, erreur: "Feuille introuvable ou vide dans ce classeur." };
  }

  const colonnes = entetesColonnes(feuille);
  const manquantes = [COLONNE_REFERENCE, COLONNE_NUM_CLIENT, COLONNE_NUM_SITE].filter((c) => !colonnes.has(c));
  if (manquantes.length > 0) {
    return { ok: false, erreur: `Colonne(s) manquante(s) : ${manquantes.join(", ")} — même format que l'export Devis attendu.` };
  }
  const col = (titre: string) => colonnes.get(titre) ?? 0;

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

    const numero = cell(row, col(COLONNE_REFERENCE));
    const numClient = entierCell(row, col(COLONNE_NUM_CLIENT));
    const numSite = entierCell(row, col(COLONNE_NUM_SITE));
    const libelle = cell(row, col("Libellé"));
    if (!numero && !numClient && !numSite && !libelle) return; // ligne vide

    if (numClient === null || numSite === null) {
      avertissements.push(`Ligne ${numeroLigne} ignorée : Numéro Client/N° Site illisible.`);
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
      avertissements.push(`Client ${numClient}-${numSite} introuvable dans le Répertoire (ligne ${numeroLigne}) — ligne ignorée.`);
      return;
    }

    // Le code nature n'est pas réexportable tel quel (l'export écrit le
    // libellé, ex. "Réparation d'un équipement") — on le retrouve par
    // correspondance inverse plutôt que de dépendre d'un code brut.
    const natureBrute = cell(row, col("Nature"));
    const nature = CODE_PAR_LABEL_NATURE.get(natureBrute) ?? (/^\d+$/.test(natureBrute) ? natureBrute : "");

    // "Item" (compteur chrono) n'est plus une colonne à part : il se
    // retrouve directement dans la référence devis (3e segment, ex.
    // "279" dans "D-26-279-BG-405-01-30").
    const item = numero.split("-")[2] ?? "";

    lignes.push({
      donnees: {
        numero,
        item,
        redacteur: cell(row, col("Rédacteur")),
        nature,
        date_devis: cell(row, col("Date devis")),
        libelle,
        montant: nombreCell(row, col("Montant")),
        date_commande_client: cell(row, col("Date commande client")),
        reference_client: cell(row, col("Référence client")),
        statut_commande_fournisseur: cell(row, col("Statut commande fournisseur")),
        date_mise_a_disposition_fourniture: cell(row, col("Date mise à disposition fourniture")),
        bi_reference_historique: cell(row, col("Réf. BI historique")),
        mois_facturation: cell(row, col("Mois facturation")),
        remarques: cell(row, col("Remarques")),
        debours_materiel_prevu: nombreCell(row, col("Débours matériel prévu")),
        heures_prevues: nombreCell(row, col("Heures prévues")),
        email_responsable_contrat: site.courriel_responsable,
        // Jamais déduit du fichier (le statut est calculé, pas une
        // colonne écrite depuis les champs bruts) — toujours posé à la
        // main par le bureau après import. Une mise à jour d'un devis
        // déjà annulé garde son statut (voir appliquerImportDevis).
        annule: false,
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
    // "annule" n'est jamais dans le fichier (voir previsualiserImportDevis)
    // — ne jamais l'écraser sur un devis déjà annulé à la main lors
    // d'un ré-import.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { annule: _annule, ...champsFichier } = ligne.donnees;
    const donnees = { ...champsFichier, site_id: ligne.siteId };
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

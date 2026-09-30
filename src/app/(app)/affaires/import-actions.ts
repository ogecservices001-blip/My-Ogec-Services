"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { NATURE_AFFAIRE } from "@/lib/affaires/constants";
import type { ActionResult } from "@/lib/action-result";
import type { AffaireInput } from "./actions";

export type LigneAffaireImport = {
  numeroDevis: string;
  designationPrestations: string;
  numeroCommandeClient: string;
  dateCommandeClient: string;
  nature: string;
  siteId: string;
  clientNom: string;
  clientSite: string;
  courrielResponsable: string;
  /// true si le fichier source ne précisait aucun site (N°Site "0" —
  /// devis au niveau client) et que la ligne a été rattachée au
  /// premier site connu du client faute de mieux.
  siteApproximatif: boolean;
  /// Affaire déjà en base pour le même (site, n° devis) — non nul quand
  /// cette ligne met à jour une affaire existante plutôt que d'en créer
  /// une nouvelle (évite les doublons à chaque ré-import du même fichier).
  affaireExistanteId: string | null;
};

export type ResultatPreviewAffaires =
  | { ok: true; lignes: LigneAffaireImport[]; avertissements: string[] }
  | { ok: false; erreur: string };

function normaliser(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function texteCell(row: ExcelJS.Row, index: number): string {
  const v = row.getCell(index + 1).value; // exceljs est 1-based
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  }
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
  return String(v).trim();
}

function entierCell(row: ExcelJS.Row, index: number): number | null {
  const s = texteCell(row, index);
  if (!s) return null;
  const sansDecimale = s.includes(".") ? s.split(".")[0] : s;
  const n = parseInt(sansDecimale, 10);
  return Number.isNaN(n) ? null : n;
}

/// Lit l'onglet AFFAIRES du fichier Excel "Base clients" — colonnes
/// fixes (B: numéro de devis, D: N° Client, E: N°Site, G: référence
/// commande client, H: date commande client, I: nature travaux, K:
/// désignation des prestations), lues par position comme côté Flutter
/// (voir AffaireImportService) — ce classeur n'a pas un format
/// générique réutilisable pour d'autres imports.
export async function previsualiserImportAffaires(
  formData: FormData,
): Promise<ResultatPreviewAffaires> {
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

  const feuille = workbook.getWorksheet("AFFAIRES") ?? workbook.worksheets[0];
  if (!feuille || feuille.rowCount === 0) {
    return { ok: false, erreur: "Feuille introuvable ou vide dans ce classeur." };
  }

  const supabase = await createClient();
  const [{ data: sites, error: errSites }, { data: affairesExistantes, error: errAff }] = await Promise.all([
    supabase.from("sites").select("id, nom, site, n_affaire, courriel_responsable"),
    supabase.from("affaires").select("id, site_id, numero_devis"),
  ]);
  if (errSites) return { ok: false, erreur: errSites.message };
  if (errAff) return { ok: false, erreur: errAff.message };

  type SiteResume = { id: string; nom: string; site: string; courriel_responsable: string };
  const siteParCle = new Map<string, SiteResume>();
  // Premier site connu (numéro le plus bas) de chaque client — repli
  // quand le fichier source ne précise aucun site (N°Site "0" = devis
  // au niveau client, pas un vrai site à part entière).
  const premierSiteParNumClient = new Map<number, { numSite: number; site: SiteResume }>();
  for (const s of sites ?? []) {
    const parts = s.n_affaire.split("-");
    if (parts.length !== 2) continue;
    const numClient = parseInt(parts[0].trim(), 10);
    const numSite = parseInt(parts[1].trim(), 10);
    if (Number.isNaN(numClient) || Number.isNaN(numSite)) continue;
    siteParCle.set(`${numClient}-${numSite}`, s);
    const existant = premierSiteParNumClient.get(numClient);
    if (!existant || numSite < existant.numSite) {
      premierSiteParNumClient.set(numClient, { numSite, site: s });
    }
  }

  const affaireParCle = new Map<string, string>();
  for (const a of affairesExistantes ?? []) {
    if (a.numero_devis) affaireParCle.set(`${a.site_id}|||${a.numero_devis}`, a.id);
  }

  const natureParLibelle = new Map<string, string>();
  for (const [code, label] of Object.entries(NATURE_AFFAIRE)) natureParLibelle.set(normaliser(label), code);

  const lignes: LigneAffaireImport[] = [];
  const avertissements: string[] = [];

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return; // en-tête

    const numeroDevis = texteCell(row, 1);
    const numeroCommandeClient = texteCell(row, 6);
    const dateCommandeClient = texteCell(row, 7);
    const natureBrute = texteCell(row, 8);
    const designation = texteCell(row, 10);
    if (!numeroDevis && !designation) return;

    const numClient = entierCell(row, 3);
    const numSite = entierCell(row, 4);
    const repere = numeroDevis || designation;
    if (numClient === null || numSite === null) {
      avertissements.push(`Ligne ${numeroLigne} ("${repere}") ignorée : N° Client/Site illisible.`);
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
      avertissements.push(`Client ${numClient}-${numSite} introuvable dans le Répertoire pour "${repere}" — ligne ignorée.`);
      return;
    }

    const nature = NATURE_AFFAIRE[natureBrute] ? natureBrute : (natureParLibelle.get(normaliser(natureBrute)) ?? "");

    lignes.push({
      numeroDevis,
      designationPrestations: designation,
      numeroCommandeClient,
      dateCommandeClient,
      nature,
      siteId: site.id,
      clientNom: site.nom,
      clientSite: site.site,
      courrielResponsable: site.courriel_responsable,
      siteApproximatif,
      affaireExistanteId: numeroDevis ? (affaireParCle.get(`${site.id}|||${numeroDevis}`) ?? null) : null,
    });
  });

  return { ok: true, lignes, avertissements };
}

/// Applique les lignes cochées par l'admin — une cellule vide dans le
/// fichier n'écrase jamais une valeur déjà saisie côté app (colonnes
/// ajoutées après coup, pas encore renseignées pour toutes les lignes
/// du classeur) : seule une valeur non vide du fichier prend le dessus.
export async function appliquerImportAffaires(
  lignes: LigneAffaireImport[],
): Promise<ActionResult & { crees?: number; misesAJour?: number }> {
  await requireAdmin();
  const supabase = await createClient();

  const idsExistants = lignes.filter((l) => l.affaireExistanteId).map((l) => l.affaireExistanteId as string);
  const { data: existantes } = idsExistants.length
    ? await supabase.from("affaires").select("*").in("id", idsExistants)
    : { data: [] };
  const existanteParId = new Map((existantes ?? []).map((a) => [a.id, a]));

  let crees = 0;
  let misesAJour = 0;

  for (const ligne of lignes) {
    const existante = ligne.affaireExistanteId ? existanteParId.get(ligne.affaireExistanteId) : undefined;
    const depuisFichierOuExistant = (depuisFichier: string, existant: string | undefined) =>
      depuisFichier || existant || "";

    const donnees: AffaireInput & { site_id: string } = {
      site_id: ligne.siteId,
      numero_devis: ligne.numeroDevis,
      designation_prestations: ligne.designationPrestations,
      email_responsable_contrat: ligne.courrielResponsable,
      numero_commande_client: depuisFichierOuExistant(ligne.numeroCommandeClient, existante?.numero_commande_client),
      date_commande_client: depuisFichierOuExistant(ligne.dateCommandeClient, existante?.date_commande_client),
      nature: depuisFichierOuExistant(ligne.nature, existante?.nature),
    };

    if (existante) {
      const { error } = await supabase
        .from("affaires")
        .update({ ...donnees, updated_at: new Date().toISOString() })
        .eq("id", existante.id);
      if (error) return { ok: false, erreur: error.message, crees, misesAJour };
      misesAJour++;
    } else {
      const { error } = await supabase.from("affaires").insert(donnees);
      if (error) return { ok: false, erreur: error.message, crees, misesAJour };
      crees++;
    }
  }

  revalidatePath("/affaires");
  return { ok: true, crees, misesAJour };
}

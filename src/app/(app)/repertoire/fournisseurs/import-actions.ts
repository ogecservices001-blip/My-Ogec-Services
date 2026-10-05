"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fournisseurSchema, type FournisseurInput } from "@/lib/validation/fournisseur";
import type { ActionResult } from "@/lib/action-result";

export type LigneDiffFournisseur = {
  donnees: FournisseurInput;
  statut: "ajout" | "modification";
  fournisseurExistantId?: string;
  differences: [string, string, string][];
};

export type ResultatPreviewFournisseurs =
  | { ok: true; lignes: LigneDiffFournisseur[]; avertissements: string[] }
  | { ok: false; erreur: string };

const LABELS: Record<keyof FournisseurInput, string> = {
  nom: "Nom",
  denomination_courte: "Dénomination courte",
  interlocuteurs: "Interlocuteurs",
  tel: "Tél fixe",
  portable: "Portable",
  courriel: "Courriel",
  site_web: "Site web",
  commune: "Commune",
  code_postal: "Code postal",
  adresse: "Adresse",
  complement_adresse: "Complément d'adresse",
  produits_cles: "Produits clés",
  remarques: "Remarques",
};

// En-têtes reconnus (insensible à la casse) — une colonne non reconnue
// est ignorée, ce qui permet de réimporter directement le fichier
// exporté par l'appli, même si l'ordre des colonnes change.
const EN_TETES_CONNUS: Record<string, keyof FournisseurInput> = {
  nom: "nom",
  "dénomination courte": "denomination_courte",
  interlocuteurs: "interlocuteurs",
  tél: "tel",
  "tél fixe": "tel",
  portable: "portable",
  courriel: "courriel",
  "site web": "site_web",
  commune: "commune",
  "code postal": "code_postal",
  adresse: "adresse",
  "complément adresse": "complement_adresse",
  "produits clés": "produits_cles",
  remarques: "remarques",
};

function normaliser(s: string): string {
  return s.trim().toLowerCase();
}

/// Classeur Excel (.xlsx/.xlsm), colonnes reconnues par en-tête —
/// même format que l'import Sites/Collaborateurs. Rapprochement par
/// nom exact.
export async function previsualiserImportFournisseurs(
  formData: FormData,
): Promise<ResultatPreviewFournisseurs> {
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

  const feuille = workbook.getWorksheet("FOURNISSEURS") ?? workbook.worksheets[0];
  if (!feuille) {
    return { ok: false, erreur: "Feuille introuvable dans ce classeur." };
  }

  const ligneEntetes = feuille.getRow(1);
  const indexParChamp = new Map<keyof FournisseurInput, number>();
  ligneEntetes.eachCell((cellule, index1Based) => {
    const champ = EN_TETES_CONNUS[normaliser(String(cellule.value ?? ""))];
    if (champ) indexParChamp.set(champ, index1Based - 1); // exceljs 1-based
  });
  if (!indexParChamp.has("nom")) {
    return { ok: false, erreur: 'Colonne "Nom" introuvable — en-têtes de colonnes attendues en première ligne.' };
  }

  const supabase = await createClient();
  const { data: existants, error } = await supabase.from("fournisseurs").select("*");
  if (error) return { ok: false, erreur: error.message };
  const parNom = new Map((existants ?? []).map((f) => [f.nom.trim().toLowerCase(), f]));

  const lignes: LigneDiffFournisseur[] = [];
  const avertissements: string[] = [];
  const vus = new Set<string>();

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return; // en-tête

    const valeur = (index0: number): string => {
      const cellule = row.getCell(index0 + 1); // exceljs 1-based
      const v = cellule.value;
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
      return String(v).trim();
    };

    const nom = valeur(indexParChamp.get("nom")!);
    if (!nom) return;
    const cleNom = nom.toLowerCase();
    if (vus.has(cleNom)) {
      avertissements.push(`"${nom}" en double dans le fichier — seule la première occurrence est prise en compte.`);
      return;
    }
    vus.add(cleNom);

    const brut: Record<string, string> = {};
    for (const [champ, index0] of indexParChamp) brut[champ] = valeur(index0);
    const parsed = fournisseurSchema.safeParse(brut);
    if (!parsed.success) {
      avertissements.push(`Ligne ${numeroLigne} ("${nom}") ignorée : ${parsed.error.issues[0]?.message}`);
      return;
    }
    const donnees = parsed.data;

    const existant = parNom.get(cleNom);
    if (!existant) {
      lignes.push({ donnees, statut: "ajout", differences: [] });
      return;
    }

    const differences: [string, string, string][] = [];
    for (const champ of indexParChamp.keys()) {
      const nouvelle = donnees[champ];
      const ancienne = String(existant[champ as keyof typeof existant] ?? "");
      if (nouvelle && nouvelle !== ancienne) differences.push([LABELS[champ], ancienne, nouvelle]);
    }
    if (differences.length > 0) {
      lignes.push({ donnees, statut: "modification", fournisseurExistantId: existant.id, differences });
    }
  });

  return { ok: true, lignes, avertissements };
}

export async function appliquerImportFournisseurs(
  lignes: LigneDiffFournisseur[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  const aInserer = lignes.filter((l) => l.statut === "ajout").map((l) => l.donnees);
  if (aInserer.length > 0) {
    const { error } = await supabase.from("fournisseurs").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
  }

  for (const ligne of lignes) {
    if (ligne.statut !== "modification" || !ligne.fournisseurExistantId) continue;
    const { error } = await supabase
      .from("fournisseurs")
      .update(ligne.donnees)
      .eq("id", ligne.fournisseurExistantId);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true, ajoutes, modifies };
}

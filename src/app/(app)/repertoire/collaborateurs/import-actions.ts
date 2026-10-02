"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { profilSchema, type ProfilInput } from "@/lib/validation/profil";
import { COLONNES_PROFILS } from "@/lib/repertoire/profils-excel";
import type { ActionResult } from "@/lib/action-result";

export type LigneDiffProfil = {
  donnees: ProfilInput;
  statut: "ajout" | "modification";
  profilExistantId?: string;
  differences: [string, string, string][];
};

export type ResultatPreviewProfils =
  | { ok: true; lignes: LigneDiffProfil[]; avertissements: string[] }
  | { ok: false; erreur: string };

const LABELS: Record<keyof ProfilInput, string> = {
  name: "Nom",
  qualite: "Qualité",
  portable: "Portable",
  email_perso: "Email personnel",
  commune_habitation: "Commune",
  vehicule: "Véhicule",
};

/// Lit le fichier Excel envoyé, extrait la feuille "COLLABORATEURS" et
/// calcule le diff par rapport aux profils déjà en base, rapprochés
/// par nom exact — jamais écrit en base ici, juste un aperçu pour
/// validation. Le rôle n'est jamais importé : un nouveau collaborateur
/// arrive en "en_attente" (fiche annuaire sans accès à l'app) — le
/// rendre admin/technicien reste une action manuelle séparée.
export async function previsualiserImportProfils(
  formData: FormData,
): Promise<ResultatPreviewProfils> {
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

  const feuille = workbook.getWorksheet("COLLABORATEURS") ?? workbook.worksheets[0];
  if (!feuille) {
    return { ok: false, erreur: 'Feuille "COLLABORATEURS" introuvable dans ce classeur.' };
  }

  const supabase = await createClient();
  const { data: existants, error } = await supabase.from("profiles").select("*");
  if (error) return { ok: false, erreur: error.message };
  const parNom = new Map((existants ?? []).map((p) => [p.name.trim().toLowerCase(), p]));

  const lignes: LigneDiffProfil[] = [];
  const avertissements: string[] = [];
  const vus = new Set<string>();

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return; // en-tête

    const valeur = (index: number): string => {
      const cellule = row.getCell(index + 1); // exceljs 1-based
      const v = cellule.value;
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
      return String(v).trim();
    };

    const nom = valeur(0);
    if (!nom) return;
    const cleNom = nom.toLowerCase();
    if (vus.has(cleNom)) {
      avertissements.push(`"${nom}" en double dans le fichier — seule la première occurrence est prise en compte.`);
      return;
    }
    vus.add(cleNom);

    const brut: Record<string, string> = {};
    for (const { index, champ } of COLONNES_PROFILS) brut[champ] = valeur(index);
    const parsed = profilSchema.safeParse(brut);
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
    for (const { champ } of COLONNES_PROFILS) {
      const nouvelle = donnees[champ];
      const ancienne = String(existant[champ as keyof typeof existant] ?? "");
      if (nouvelle && nouvelle !== ancienne) differences.push([LABELS[champ], ancienne, nouvelle]);
    }
    if (differences.length > 0) {
      lignes.push({ donnees, statut: "modification", profilExistantId: existant.id, differences });
    }
  });

  return { ok: true, lignes, avertissements };
}

export async function appliquerImportProfils(
  lignes: LigneDiffProfil[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  const aInserer = lignes
    .filter((l) => l.statut === "ajout")
    .map((l) => ({ ...l.donnees, id: crypto.randomUUID(), role: "en_attente" as const }));
  if (aInserer.length > 0) {
    const { error } = await supabase.from("profiles").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
  }

  for (const ligne of lignes) {
    if (ligne.statut !== "modification" || !ligne.profilExistantId) continue;
    const { error } = await supabase
      .from("profiles")
      .update(ligne.donnees)
      .eq("id", ligne.profilExistantId);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  revalidatePath("/repertoire/collaborateurs");
  return { ok: true, ajoutes, modifies };
}

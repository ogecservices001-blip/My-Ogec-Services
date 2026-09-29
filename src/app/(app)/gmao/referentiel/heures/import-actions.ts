"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { referenceHoraireSchema, type ReferenceHoraireInput } from "@/lib/validation/reference-horaire";
import type { ActionResult } from "@/lib/action-result";

export type ResultatPreviewHeures =
  | { ok: true; lignes: ReferenceHoraireInput[]; avertissements: string[]; nbExistantes: number }
  | { ok: false; erreur: string };

/// En-têtes reconnus (normalisés : espaces réduits, casse ignorée) —
/// même correspondance que references_horaires_service.dart, colonnes
/// repérées par en-tête plutôt que par position pour rester robuste que
/// le fichier soit la source d'origine ou notre propre export.
const ENTETES: Record<string, keyof ReferenceHoraireInput> = {
  "désignation": "designation",
  "type equipement 1": "type_equipement1",
  "type equipement 2": "type_equipement2",
  "type equipement 3": "type_equipement3",
  "hrs tech an": "hrs_tech_an",
  "hrs assistant an": "hrs_assistant_an",
  "hrs tech sem": "hrs_tech_sem",
  "hrs assistant sem": "hrs_assistant_sem",
  "hrs tech tri": "hrs_tech_tri",
  "hrs assistant tri": "hrs_assistant_tri",
};

function normaliser(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/// Analyse le classeur "Base horaire équipement" — ne modifie rien,
/// juste un aperçu avant confirmation, car l'import réel REMPLACE tout
/// le référentiel existant (comme importerClasseur() côté Flutter,
/// avec en plus cette étape de confirmation explicite que l'app mobile
/// n'avait pas).
export async function previsualiserImportHeures(formData: FormData): Promise<ResultatPreviewHeures> {
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
  if (!feuille) return { ok: false, erreur: "Classeur vide." };

  const colonnesParChamp = new Map<keyof ReferenceHoraireInput, number>();
  feuille.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const champ = ENTETES[normaliser(String(cell.value ?? ""))];
    if (champ) colonnesParChamp.set(champ, colNumber);
  });

  if (!colonnesParChamp.has("designation")) {
    return { ok: false, erreur: 'Colonne "Désignation" introuvable dans ce classeur.' };
  }

  const lignes: ReferenceHoraireInput[] = [];
  const avertissements: string[] = [];

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return;

    const valeur = (champ: keyof ReferenceHoraireInput): string => {
      const col = colonnesParChamp.get(champ);
      if (!col) return "";
      const v = row.getCell(col).value;
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "text" in v) {
        return String((v as { text: unknown }).text ?? "").trim();
      }
      return String(v).trim();
    };

    const designation = valeur("designation");
    if (!designation) return;

    const brut: Record<string, string> = { designation };
    for (const champ of Object.values(ENTETES)) {
      if (champ === "designation") continue;
      brut[champ] = valeur(champ).replace(",", ".");
    }

    const parsed = referenceHoraireSchema.safeParse(brut);
    if (!parsed.success) {
      avertissements.push(
        `Ligne ${numeroLigne} ("${designation}") ignorée : ${parsed.error.issues[0]?.message}`,
      );
      return;
    }
    lignes.push(parsed.data);
  });

  const supabase = await createClient();
  const { count } = await supabase
    .from("references_horaires")
    .select("*", { count: "exact", head: true });

  return { ok: true, lignes, avertissements, nbExistantes: count ?? 0 };
}

/// Remplace tout le référentiel des heures par les lignes déjà
/// analysées et confirmées par l'admin — jamais un nouveau parsing du
/// fichier.
export async function remplacerReferencesHoraires(
  lignes: ReferenceHoraireInput[],
): Promise<ActionResult & { compte?: number }> {
  await requireAdmin();

  const supabase = await createClient();

  const { error: errSuppr } = await supabase.from("references_horaires").delete().not("id", "is", null);
  if (errSuppr) return { ok: false, erreur: errSuppr.message };

  if (lignes.length > 0) {
    const { error: errInsert } = await supabase.from("references_horaires").insert(lignes);
    if (errInsert) return { ok: false, erreur: errInsert.message };
  }

  revalidatePath("/gmao/referentiel/heures");
  return { ok: true, compte: lignes.length };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { analyserImportFamilles, type ResumeFamille } from "@/lib/gmao/familles-import";
import { classeurRapportFamilles } from "@/lib/gmao/familles-import-rapport";
import type { TypeEquipement } from "@/lib/gmao/types";

export type ApercuImportFamilles =
  | { ok: true; resumes: ResumeFamille[]; avertissements: string[]; rapport: string }
  | { ok: false; erreur: string };

async function analyser(formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false as const, erreur: "Aucun fichier sélectionné." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("types_equipement").select("*");
  if (error) return { ok: false as const, erreur: error.message };
  const existantes = (data ?? []) as TypeEquipement[];
  const res = await analyserImportFamilles(await fichier.arrayBuffer(), existantes);
  return { ...res, supabase, existantes };
}

/// Aperçu : ne modifie rien.
export async function previsualiserImportFamilles(formData: FormData): Promise<ApercuImportFamilles> {
  await requireAdmin();
  const res = await analyser(formData);
  if (!res.ok) return { ok: false, erreur: res.erreur };
  const { familles, resumes, avertissements } = res.resultat;
  const touchees = familles.filter((_, i) => resumes[i].nouvelle || resumes[i].changements.length > 0);
  const rapport = await classeurRapportFamilles(res.existantes, touchees, avertissements);
  return { ok: true, resumes, avertissements, rapport };
}

/// Application : le fichier est réanalysé côté serveur, seules les familles
/// nouvelles ou modifiées sont écrites. Rien n'est supprimé.
export async function appliquerImportFamilles(
  formData: FormData,
): Promise<{ ok: true; nbEcrites: number } | { ok: false; erreur: string }> {
  await requireAdmin();
  const res = await analyser(formData);
  if (!res.ok) return { ok: false, erreur: res.erreur };
  const { familles, resumes } = res.resultat;
  const aEcrire = familles.filter((_, i) => resumes[i].nouvelle || resumes[i].changements.length > 0);
  if (aEcrire.length === 0) return { ok: true, nbEcrites: 0 };
  const { error } = await res.supabase.from("types_equipement").upsert(aEcrire, { onConflict: "id" });
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/gmao/referentiel/familles");
  return { ok: true, nbEcrites: aEcrire.length };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fournisseurSchema } from "@/lib/validation/fournisseur";
import type { ActionResult } from "@/lib/action-result";

function lireFormulaire(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [cle, valeur] of formData.entries()) {
    if (typeof valeur === "string") obj[cle] = valeur;
  }
  return obj;
}

export async function creerFournisseur(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = fournisseurSchema.safeParse(lireFormulaire(formData));
  if (!parsed.success) {
    const champs: Record<string, string> = {};
    for (const issue of parsed.error.issues) champs[String(issue.path[0])] = issue.message;
    return { ok: false, erreur: "Formulaire invalide.", champs };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fournisseurs").insert(parsed.data);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true };
}

export async function modifierFournisseur(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = fournisseurSchema.safeParse(lireFormulaire(formData));
  if (!parsed.success) {
    const champs: Record<string, string> = {};
    for (const issue of parsed.error.issues) champs[String(issue.path[0])] = issue.message;
    return { ok: false, erreur: "Formulaire invalide.", champs };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fournisseurs")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  revalidatePath(`/repertoire/fournisseurs/${id}`);
  return { ok: true };
}

export async function supprimerFournisseur(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("fournisseurs").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { referenceHoraireSchema } from "@/lib/validation/reference-horaire";
import type { ActionResult } from "@/lib/action-result";

export async function creerReferenceHoraire(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = referenceHoraireSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("references_horaires").insert(parsed.data);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/gmao/referentiel/heures");
  return { ok: true };
}

export async function modifierReferenceHoraire(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = referenceHoraireSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("references_horaires")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/gmao/referentiel/heures");
  return { ok: true };
}

export async function supprimerReferenceHoraire(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("references_horaires").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/gmao/referentiel/heures");
  return { ok: true };
}

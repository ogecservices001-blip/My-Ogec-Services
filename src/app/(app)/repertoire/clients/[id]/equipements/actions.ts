"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { equipementSchema } from "@/lib/validation/equipement";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";
import type { ActionResult } from "@/lib/action-result";

/// Le "+" pour ajouter un équipement n'est pas réservé aux admins côté
/// Flutter (accès terrain) — seule la suppression l'est (voir RLS
/// migration 0006).
export async function creerEquipement(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const parsed = equipementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  let champsEnTete: ChampsEnTeteEquipement = {};
  try {
    champsEnTete = JSON.parse(String(formData.get("champs_en_tete_json") ?? "{}"));
  } catch {
    return { ok: false, erreur: "Champs spécifiques invalides." };
  }

  const supabase = await createClient();

  const { data: type } = await supabase
    .from("types_equipement")
    .select("type_equipement1_fixe")
    .eq("id", parsed.data.type_equipement_id)
    .single();
  if (type?.type_equipement1_fixe) {
    champsEnTete.typeEquipement1 = type.type_equipement1_fixe;
  }

  const { data: references } = await supabase.from("references_horaires").select("*");
  const { reference } = analyserReference(champsEnTete, references ?? []);

  const { error } = await supabase.from("equipements").insert({
    ...parsed.data,
    champs_en_tete: champsEnTete,
    reference_horaire_id: reference?.id ?? null,
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/repertoire/clients/${parsed.data.site_id}/equipements`);
  return { ok: true };
}

export async function supprimerEquipement(id: string, siteId: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("equipements").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/repertoire/clients/${siteId}/equipements`);
  return { ok: true };
}

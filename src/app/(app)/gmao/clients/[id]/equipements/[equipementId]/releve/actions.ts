"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import type { ChampsEnTeteEquipement, ChecklistValues, GroupesMesuresReleve } from "@/lib/gmao/types";
import type { ActionResult } from "@/lib/action-result";

/// Enregistre un relevé (visite) : met à jour les champs d'en-tête
/// permanents de l'équipement (marque, référence, type equipement...)
/// ET crée un nouveau document d'historique `releves` — comme
/// dynamic_releve_form_screen.dart, qui traite ces deux écritures comme
/// une seule action "Enregistrer le relevé".
export async function creerReleve(
  equipementId: string,
  siteId: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireProfile();

  let champsEnTete: ChampsEnTeteEquipement = {};
  let checklistValues: ChecklistValues = {};
  let groupesMesures: GroupesMesuresReleve = {};
  try {
    champsEnTete = JSON.parse(String(formData.get("champs_en_tete_json") ?? "{}"));
    checklistValues = JSON.parse(String(formData.get("checklist_json") ?? "{}"));
    groupesMesures = JSON.parse(String(formData.get("groupes_mesures_json") ?? "{}"));
  } catch {
    return { ok: false, erreur: "Données du formulaire invalides." };
  }

  const supabase = await createClient();

  const { data: equipement, error: errEq } = await supabase
    .from("equipements")
    .select("id, site_id, type_equipement_id")
    .eq("id", equipementId)
    .single();
  if (errEq || !equipement) return { ok: false, erreur: "Équipement introuvable." };

  const { data: type } = await supabase
    .from("types_equipement")
    .select("type_equipement1_fixe")
    .eq("id", equipement.type_equipement_id)
    .single();
  if (type?.type_equipement1_fixe) {
    champsEnTete.typeEquipement1 = type.type_equipement1_fixe;
  }

  const { data: references } = await supabase.from("references_horaires").select("*");
  const { reference } = analyserReference(champsEnTete, references ?? []);

  const { error: errUpdate } = await supabase
    .from("equipements")
    .update({ champs_en_tete: champsEnTete, reference_horaire_id: reference?.id ?? null })
    .eq("id", equipementId);
  if (errUpdate) return { ok: false, erreur: errUpdate.message };

  const nomTech = typeof champsEnTete.nomTech === "string" ? champsEnTete.nomTech : profile.name;
  const validation = String(formData.get("validation_fonctionnement") ?? "").trim() || null;

  const { error: errInsert } = await supabase.from("releves").insert({
    equipement_id: equipementId,
    site_id: siteId,
    date: new Date().toISOString(),
    nom_tech: nomTech,
    checklist_values: checklistValues,
    groupes_mesures: groupesMesures,
    validation_fonctionnement: validation,
    remarque1: String(formData.get("remarque1") ?? ""),
    remarque2: String(formData.get("remarque2") ?? ""),
    informations_internes: String(formData.get("informations_internes") ?? ""),
  });
  if (errInsert) return { ok: false, erreur: errInsert.message };

  revalidatePath(`/gmao/clients/${siteId}/equipements`);
  revalidatePath(`/gmao/clients/${siteId}/equipements/${equipementId}`);
  return { ok: true };
}

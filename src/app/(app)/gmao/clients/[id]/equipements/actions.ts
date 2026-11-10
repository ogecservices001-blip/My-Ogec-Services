"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { equipementSchema } from "@/lib/validation/equipement";
import { suggererNumeroEquipement } from "@/lib/gmao/numero-equipement";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";
import type { ActionResult } from "@/lib/action-result";

function formaterDateJour(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}

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


  const [{ data: site }, { data: equipementsSite }] = await Promise.all([
    supabase.from("sites_view").select("n_affaire, hors_contrat").eq("id", parsed.data.site_id).single(),
    supabase.from("equipements").select("numero_equipement").eq("site_id", parsed.data.site_id),
  ]);

  const numeroEquipement =
    parsed.data.numero_equipement ||
    suggererNumeroEquipement(site?.n_affaire ?? "", (equipementsSite ?? []).map((e) => e.numero_equipement));

  // Ajouter un équipement n'étend jamais automatiquement la couverture
  // du contrat existant — même règle que la validation BI Installation
  // neuve (voir bi/[id]/actions.ts) : toujours hors contrat à la
  // création, avec une mention explicite si le site était sous contrat.
  const remarqueTechnicien = `Ajouté depuis GMAO le ${formaterDateJour(new Date())}${
    site && !site.hors_contrat ? " — Hors contrat, avenant à faire." : ""
  }`;

  const { error } = await supabase.from("equipements").insert({
    ...parsed.data,
    numero_equipement: numeroEquipement,
    champs_en_tete: champsEnTete,
    hors_contrat: true,
    a_valider: true,
    remarque_technicien: remarqueTechnicien,
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/gmao/clients/${parsed.data.site_id}/equipements`);
  return { ok: true };
}

/// Correction de fiche — notamment pour permettre à l'admin de corriger
/// les données avant de valider un équipement ajouté depuis le terrain
/// (voir `validerEquipement`). Ne touche jamais à `hors_contrat`,
/// `a_valider` ni `remarque_technicien` : ces statuts se décident à la
/// création ou via `validerEquipement`, pas à chaque modification.
export async function modifierEquipement(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

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


  const { error } = await supabase
    .from("equipements")
    .update({
      ...parsed.data,
      champs_en_tete: champsEnTete,
    })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/gmao/clients/${parsed.data.site_id}/equipements`);
  revalidatePath(`/gmao/clients/${parsed.data.site_id}/equipements/${id}`);
  return { ok: true };
}

export async function supprimerEquipement(id: string, siteId: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("equipements").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/gmao/clients/${siteId}/equipements`);
  return { ok: true };
}

export async function validerEquipement(id: string, siteId: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("equipements").update({ a_valider: false }).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/gmao/clients/${siteId}/equipements`);
  revalidatePath(`/gmao/clients/${siteId}/equipements/${id}`);
  return { ok: true };
}

/// Avenant signé : l'équipement passe sous contrat (ou en sort). La remarque
/// garde la trace du changement.
export async function changerContratEquipement(
  id: string,
  siteId: string,
  sousContrat: boolean,
  dateAvenant: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (sousContrat && !/^\d{4}-\d{2}-\d{2}$/.test(dateAvenant)) {
    return { ok: false, erreur: "Indique la date de l'avenant." };
  }
  const supabase = await createClient();
  const { data: eq } = await supabase.from("equipements").select("remarque_technicien").eq("id", id).single();
  if (!eq) return { ok: false, erreur: "Équipement introuvable." };
  const aujourdhui = formaterDateJour(new Date());
  const trace = sousContrat
    ? `Passé sous contrat le ${aujourdhui} (avenant du ${dateAvenant.split("-").reverse().join("/")}).`
    : `Repassé hors contrat le ${aujourdhui}.`;
  const { error } = await supabase
    .from("equipements")
    .update({
      hors_contrat: !sousContrat,
      remarque_technicien: eq.remarque_technicien ? `${eq.remarque_technicien}\n${trace}` : trace,
    })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath(`/gmao/clients/${siteId}/equipements`);
  revalidatePath(`/gmao/clients/${siteId}/equipements/${id}`);
  return { ok: true };
}

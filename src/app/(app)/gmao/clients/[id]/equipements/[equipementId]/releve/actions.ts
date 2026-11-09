"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { freqCouranteCalculee } from "@/lib/gmao/releve-service";
import { chargerDevisEnCoursParEquipement, type DevisEnCours } from "@/lib/devis/en-cours";
import type {
  ChampsEnTeteEquipement,
  ChecklistValues,
  Equipement,
  GroupesMesuresReleve,
  Releve,
  TypeEquipement,
} from "@/lib/gmao/types";
import type { ActionResult } from "@/lib/action-result";

/// Enregistre un relevé (visite) : met à jour les champs d'en-tête
/// permanents de l'équipement (marque, référence, type equipement...)
/// ET crée un nouveau document d'historique `releves` — comme
/// dynamic_releve_form_screen.dart, qui traite ces deux écritures comme
/// une seule action "Enregistrer le relevé". Avec `releve_id` : corrige un
/// relevé pas encore rattaché à une visite validée.
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
  const contenu = {
    nom_tech: nomTech,
    checklist_values: checklistValues,
    groupes_mesures: groupesMesures,
    validation_fonctionnement: validation,
    remarque1: String(formData.get("remarque1") ?? ""),
    remarque2: String(formData.get("remarque2") ?? ""),
    informations_internes: String(formData.get("informations_internes") ?? ""),
  };

  const releveId = String(formData.get("releve_id") ?? "");
  if (releveId) {
    const { data: modifies, error } = await supabase
      .from("releves")
      .update(contenu)
      .eq("id", releveId)
      .eq("equipement_id", equipementId)
      .is("bon_intervention_id", null)
      .select("id");
    if (error) return { ok: false, erreur: error.message };
    if (!modifies || modifies.length === 0) {
      return { ok: false, erreur: "Ce relevé est déjà rattaché à une visite validée : il ne se modifie plus." };
    }
  } else {
    const { error: errInsert } = await supabase.from("releves").insert({
      equipement_id: equipementId,
      site_id: siteId,
      date: new Date().toISOString(),
      ...contenu,
    });
    if (errInsert) return { ok: false, erreur: errInsert.message };
  }

  revalidatePath(`/gmao/clients/${siteId}/equipements`);
  revalidatePath(`/gmao/clients/${siteId}/equipements/${equipementId}`);
  return { ok: true };
}

export type FicheReleve = {
  equipement: Equipement;
  type: TypeEquipement;
  freqCourante: number | null;
  devisEnCours: DevisEnCours[];
  depannagesOuverts: { id: string; numero: string; message: string }[];
  /// Relevé pas encore rattaché à une visite : rouvert pour correction.
  releveExistant: Releve | null;
};

/// Tout ce qu'il faut pour ouvrir la fiche d'entretien d'un équipement depuis
/// le BI Entretien, sans quitter l'assistant.
export async function chargerFicheReleve(equipementId: string): Promise<FicheReleve | null> {
  await requireProfile();
  const supabase = await createClient();
  const { data: equipement } = await supabase.from("equipements").select("*").eq("id", equipementId).single();
  if (!equipement) return null;
  const [{ data: type }, freqCourante, devisParEquipement, { data: depannages }, { data: releves }] = await Promise.all([
    supabase.from("types_equipement").select("*").eq("id", equipement.type_equipement_id).single(),
    freqCouranteCalculee(supabase, equipementId),
    chargerDevisEnCoursParEquipement(),
    supabase
      .from("demandes_depannage")
      .select("id, numero, message")
      .eq("equipement_id", equipementId)
      .neq("statut", "traitee")
      .order("date_creation", { ascending: false }),
    supabase
      .from("releves")
      .select("*")
      .eq("equipement_id", equipementId)
      .is("bon_intervention_id", null)
      .order("date", { ascending: false })
      .limit(1),
  ]);
  if (!type) return null;
  return {
    equipement: equipement as Equipement,
    type: type as TypeEquipement,
    freqCourante,
    devisEnCours: devisParEquipement[equipementId] ?? [],
    depannagesOuverts: (depannages ?? []) as { id: string; numero: string; message: string }[],
    releveExistant: ((releves ?? [])[0] as Releve | undefined) ?? null,
  };
}

/// Relevés en attente (pas encore rattachés à une visite) des équipements d'un
/// site : équipement → fonctionnement saisi.
export async function etatRelevesEnAttente(siteId: string): Promise<Record<string, string>> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("releves")
    .select("equipement_id, validation_fonctionnement, date")
    .eq("site_id", siteId)
    .is("bon_intervention_id", null)
    .order("date");
  const etat: Record<string, string> = {};
  for (const r of data ?? []) etat[r.equipement_id] = r.validation_fonctionnement ?? "Fait";
  return etat;
}

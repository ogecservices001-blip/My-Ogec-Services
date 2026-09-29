"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { prochainChrono } from "@/lib/gmao/chrono";
import type { ActionResult } from "@/lib/action-result";

export type EquipementDuSite = {
  id: string;
  nom: string;
  numero_equipement: string;
  localisation: string;
};

export async function chargerEquipementsDuSite(siteId: string): Promise<EquipementDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, nom, numero_equipement, localisation")
    .eq("site_id", siteId)
    .order("nom");
  return data ?? [];
}

export async function creerDepannage(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireProfile();

  const siteId = String(formData.get("site_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const equipementId = String(formData.get("equipement_id") ?? "").trim();
  const intervenantId = String(formData.get("intervenant_id") ?? "").trim();
  const dateInterventionPrevue = String(formData.get("date_intervention_prevue") ?? "").trim();
  const lieuPanne = String(formData.get("lieu_panne") ?? "").trim();
  const numeroDemandeClient = String(formData.get("numero_demande_client") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!siteId) return { ok: false, erreur: "Le client/site est obligatoire." };
  if (!message) return { ok: false, erreur: "Merci de décrire la panne rencontrée." };

  const supabase = await createClient();

  const { data: site, error: errSite } = await supabase
    .from("sites")
    .select("nom, site")
    .eq("id", siteId)
    .single();
  if (errSite || !site) return { ok: false, erreur: "Site introuvable." };

  let equipementNom = "";
  if (equipementId) {
    const { data: eq } = await supabase.from("equipements").select("nom").eq("id", equipementId).single();
    equipementNom = eq?.nom ?? "";
  }

  const numero = await prochainChrono(supabase, "depannage");

  const { error } = await supabase.from("demandes_depannage").insert({
    numero,
    site_id: siteId,
    equipement_id: equipementId || null,
    client_nom: site.nom,
    client_site: site.site,
    equipement_nom: equipementNom,
    email,
    message,
    statut: "nouvelle",
    intervenant_id: intervenantId || null,
    date_intervention_prevue: dateInterventionPrevue || null,
    lieu_panne: lieuPanne,
    numero_demande_client: numeroDemandeClient,
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/depannages");
  return { ok: true };
}

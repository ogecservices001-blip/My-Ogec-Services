"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { prochainChrono } from "@/lib/gmao/chrono";
import { envoyerConfirmationDepannage } from "@/lib/gmao/depannage-confirmation-email";
import type { ActionResult } from "@/lib/action-result";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateJour(date: Date): string {
  return `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}`;
}

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
  const envoyerEmail = formData.get("envoyer_email") === "1";

  if (!siteId) return { ok: false, erreur: "Le client/site est obligatoire." };
  if (!message) return { ok: false, erreur: "Merci de décrire la panne rencontrée." };

  const supabase = await createClient();

  const { data: site, error: errSite } = await supabase
    .from("sites")
    .select(
      "nom, site, n_affaire, code_postal, commune, adresse, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site",
    )
    .eq("id", siteId)
    .single();
  if (errSite || !site) return { ok: false, erreur: "Site introuvable." };

  let equipementNom = "";
  if (equipementId) {
    const { data: eq } = await supabase.from("equipements").select("nom").eq("id", equipementId).single();
    equipementNom = eq?.nom ?? "";
  }

  let intervenantTexte = "";
  if (intervenantId) {
    const { data: intervenant } = await supabase.from("profiles").select("name, portable").eq("id", intervenantId).single();
    if (intervenant) intervenantTexte = [intervenant.name, intervenant.portable].filter(Boolean).join(" — ");
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

  if (envoyerEmail && email) {
    try {
      await envoyerConfirmationDepannage({
        destinataire: email,
        numero,
        nAffaire: site.n_affaire,
        clientNom: site.nom,
        clientSite: site.site,
        dateDemande: formaterDateJour(new Date()),
        motif: message,
        lieuPanne,
        numeroDemandeClient,
        intervenant: intervenantTexte,
        dateInterventionPrevue: dateInterventionPrevue ? formaterDateJour(new Date(`${dateInterventionPrevue}T00:00:00`)) : "",
        codePostal: site.code_postal,
        commune: site.commune,
        adresse: site.adresse,
        interlocuteurSite: site.interlocuteur_site,
        tel1: site.tel_fixe_interlocuteur_site,
        tel2: site.portable_interlocuteur_site,
        informationComplementaire: "",
      });
    } catch (e) {
      // Le ticket est déjà créé — un échec d'envoi ne doit pas bloquer
      // le flux ni risquer une double création si le bureau réessaie.
      console.error("Échec envoi email de confirmation dépannage", e);
    }
  }

  return { ok: true };
}

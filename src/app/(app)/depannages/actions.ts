"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { envoyerConfirmationDepannage } from "@/lib/gmao/depannage-confirmation-email";
import type { ActionResult } from "@/lib/action-result";

export async function marquerTraitee(id: string): Promise<ActionResult> {
  await requireProfile();

  const supabase = await createClient();
  const { error } = await supabase
    .from("demandes_depannage")
    .update({ statut: "traitee", date_traitement: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/depannages");
  return { ok: true };
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formaterDateJour(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/// Envoie au client l'email de confirmation/prise en compte (tableau
/// récapitulatif) — n'exige pas que le ticket soit marqué "traitée",
/// c'est une action indépendante.
export async function envoyerConfirmation(id: string, informationComplementaire: string): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();

  const { data: demande, error: errD } = await supabase
    .from("demandes_depannage")
    .select("*")
    .eq("id", id)
    .single();
  if (errD || !demande) return { ok: false, erreur: "Demande introuvable." };
  if (!demande.email) return { ok: false, erreur: "Aucun email connu pour ce ticket." };

  const { data: site } = demande.site_id
    ? await supabase
        .from("sites")
        .select("n_affaire, code_postal, commune, adresse, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site")
        .eq("id", demande.site_id)
        .single()
    : { data: null };

  let intervenantTexte = "";
  if (demande.intervenant_id) {
    const { data: intervenant } = await supabase
      .from("profiles")
      .select("name, portable")
      .eq("id", demande.intervenant_id)
      .single();
    if (intervenant) intervenantTexte = [intervenant.name, intervenant.portable].filter(Boolean).join(" — ");
  }

  try {
    await envoyerConfirmationDepannage({
      destinataire: demande.email,
      numero: demande.numero,
      nAffaire: site?.n_affaire ?? "",
      clientNom: demande.client_nom,
      clientSite: demande.client_site,
      dateDemande: formaterDateHeure(demande.date_creation),
      motif: demande.message,
      lieuPanne: demande.lieu_panne,
      numeroDemandeClient: demande.numero_demande_client,
      intervenant: intervenantTexte,
      dateInterventionPrevue: demande.date_intervention_prevue ? formaterDateJour(demande.date_intervention_prevue) : "",
      codePostal: site?.code_postal ?? "",
      commune: site?.commune ?? "",
      adresse: site?.adresse ?? "",
      interlocuteurSite: site?.interlocuteur_site ?? "",
      tel1: site?.tel_fixe_interlocuteur_site ?? "",
      tel2: site?.portable_interlocuteur_site ?? "",
      informationComplementaire,
    });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi." };
  }

  return { ok: true };
}

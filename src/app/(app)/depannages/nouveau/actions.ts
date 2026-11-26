"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifierProfil } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { prochainChrono } from "@/lib/gmao/chrono";
import { envoyerConfirmationDepannage } from "@/lib/gmao/depannage-confirmation-email";
import { telInternational } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateJour(date: Date): string {
  return `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/// Prévient le technicien sur son téléphone qu'un dépannage lui est affecté.
function prevenirTechnicien(
  technicienId: string,
  d: { numero: string; client: string; site: string; equipement: string; date: string; message: string },
) {
  const date = d.date ? ` · prévu le ${d.date.split("-").reverse().join("/")}` : "";
  const ligne = [[d.client, d.site].filter(Boolean).join(" — "), d.equipement].filter(Boolean).join(" · ");
  after(() =>
    notifierProfil(technicienId, {
      titre: `Nouveau dépannage N°${d.numero}`,
      texte: [`${ligne}${date}`, d.message.slice(0, 160)].filter(Boolean).join("\n"),
      url: "/",
      tag: `depannage-${d.numero}`,
    }),
  );
}

export type EquipementDuSite = {
  id: string;
  nom: string;
  numero_equipement: string;
  localisation: string;
  groupe: string;
};

export async function chargerEquipementsDuSite(siteId: string): Promise<EquipementDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, nom, numero_equipement, localisation, groupe")
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
    if (intervenant) intervenantTexte = [intervenant.name, telInternational(intervenant.portable)].filter(Boolean).join(" — ");
  }

  const numero = await prochainChrono(supabase, "depannage");

  const { data: creee, error } = await supabase
    .from("demandes_depannage")
    .insert({
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
    })
    .select("id")
    .single();
  if (error || !creee) return { ok: false, erreur: error?.message ?? "Échec de la création." };

  revalidatePath("/depannages");
  if (intervenantId) {
    prevenirTechnicien(intervenantId, {
      numero: String(numero),
      client: site.nom,
      site: site.site,
      equipement: equipementNom,
      date: dateInterventionPrevue,
      message,
    });
  }

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
        tel1: telInternational(site.tel_fixe_interlocuteur_site),
        tel2: telInternational(site.portable_interlocuteur_site),
        informationComplementaire: "",
      });
      await supabase
        .from("demandes_depannage")
        .update({ email_prise_en_compte_envoye_le: new Date().toISOString() })
        .eq("id", creee.id);
    } catch (e) {
      // Le ticket est déjà créé — un échec d'envoi ne doit pas bloquer
      // le flux ni risquer une double création si le bureau réessaie.
      console.error("Échec envoi email de confirmation dépannage", e);
    }
  }

  return { ok: true };
}

/// Met à jour un dépannage existant — même formulaire que la création
/// (NouveauDepannageForm en mode édition), utilisé notamment pour
/// assigner un technicien et une date d'intervention à un dépannage
/// encore "Nouveau".
export async function modifierDepannage(
  id: string,
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

  const { data: existante, error: errExistante } = await supabase
    .from("demandes_depannage")
    .select("numero, intervenant_id")
    .eq("id", id)
    .single();
  if (errExistante || !existante) return { ok: false, erreur: "Dépannage introuvable." };

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
    if (intervenant) intervenantTexte = [intervenant.name, telInternational(intervenant.portable)].filter(Boolean).join(" — ");
  }

  const { error } = await supabase
    .from("demandes_depannage")
    .update({
      site_id: siteId,
      equipement_id: equipementId || null,
      client_nom: site.nom,
      client_site: site.site,
      equipement_nom: equipementNom,
      email,
      message,
      intervenant_id: intervenantId || null,
      date_intervention_prevue: dateInterventionPrevue || null,
      lieu_panne: lieuPanne,
      numero_demande_client: numeroDemandeClient,
    })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/depannages");
  revalidatePath(`/depannages/${id}`);
  if (intervenantId && intervenantId !== existante.intervenant_id) {
    prevenirTechnicien(intervenantId, {
      numero: String(existante.numero),
      client: site.nom,
      site: site.site,
      equipement: equipementNom,
      date: dateInterventionPrevue,
      message,
    });
  }

  if (envoyerEmail && email) {
    try {
      await envoyerConfirmationDepannage({
        destinataire: email,
        numero: existante.numero,
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
        tel1: telInternational(site.tel_fixe_interlocuteur_site),
        tel2: telInternational(site.portable_interlocuteur_site),
        informationComplementaire: "",
      });
      await supabase
        .from("demandes_depannage")
        .update({ email_prise_en_compte_envoye_le: new Date().toISOString() })
        .eq("id", id);
    } catch (e) {
      console.error("Échec envoi email de confirmation dépannage (modification)", e);
    }
  }

  return { ok: true };
}

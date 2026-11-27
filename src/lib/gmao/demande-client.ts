import type { createAdminClient } from "@/lib/supabase/admin";
import { messageErreur, signalerIncident } from "@/lib/incidents";
import { envoyerNotificationDepannage } from "@/lib/gmao/depannage-email";
import { envoyerConfirmationDepannage } from "@/lib/gmao/depannage-confirmation-email";
import { telInternational } from "@/lib/format";
import { prochainChrono } from "@/lib/gmao/chrono";

type Admin = ReturnType<typeof createAdminClient>;

export type ResultatDemande = { ok: true; numero: string; accuseEnvoye: boolean } | { ok: false; erreur: string };

/// Demande de dépannage faite par un client (page QR ou « Mon contrat
/// OGEC »), adresse déjà vérifiée par l'appelant : enregistrement, note sur
/// l'équipement, mail au bureau, accusé de réception au client (même tableau
/// de prise en compte que pour une demande créée au bureau ; le bureau garde
/// son envoi complet une fois l'intervention planifiée).
export async function enregistrerDemandeClient(
  admin: Admin,
  params: {
    site: { id: string; nom: string; site: string };
    equipement: { id: string; nom: string; localisation: string } | null;
    email: string;
    message: string;
    origine: string;
  },
): Promise<ResultatDemande> {
  const { site, equipement, email, origine } = params;
  const message = params.message.trim();
  if (!message) return { ok: false, erreur: "Merci de décrire la panne rencontrée." };

  const numero = await prochainChrono(admin, "depannage");
  const { data: creee, error } = await admin
    .from("demandes_depannage")
    .insert({
      numero,
      equipement_id: equipement?.id ?? null,
      site_id: site.id,
      client_nom: site.nom,
      client_site: site.site,
      equipement_nom: equipement?.nom ?? "",
      email,
      message,
      statut: "nouvelle",
    })
    .select("id")
    .single();
  if (error || !creee) return { ok: false, erreur: "L'envoi a échoué, merci de réessayer dans un instant." };

  if (equipement) {
    const dateLisible = new Date().toLocaleString("fr-FR", { timeZone: "Indian/Reunion" });
    const note = `Demande de dépannage reçue le ${dateLisible} (${email})\n${message}`;
    const { data: actuel } = await admin.from("equipements").select("remarque_technicien").eq("id", equipement.id).single();
    const existante = actuel?.remarque_technicien ?? "";
    await admin.from("equipements").update({ remarque_technicien: existante ? `${existante}\n---\n${note}` : note }).eq("id", equipement.id);
  }

  try {
    await envoyerNotificationDepannage({
      clientNom: site.nom,
      clientSite: site.site,
      equipementNom: equipement?.nom ?? "Équipement non précisé",
      email,
      message,
    });
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: `Demande de dépannage N°${numero} (${origine}) : mail au bureau non envoyé`,
      detail: `${site.nom} — ${site.site} · ${equipement?.nom ?? "équipement non précisé"} · ${email}\n${message}\n\n${messageErreur(e)}`,
      objetType: "depannage",
      objetId: creee.id,
      lien: `/depannages/${creee.id}`,
    });
  }

  let accuseEnvoye = false;
  try {
    const { data: s } = await admin
      .from("sites")
      .select("n_affaire, code_postal, commune, adresse, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site")
      .eq("id", site.id)
      .single();
    await envoyerConfirmationDepannage({
      destinataire: email,
      numero: String(numero),
      nAffaire: s?.n_affaire ?? "",
      clientNom: site.nom,
      clientSite: site.site,
      dateDemande: new Date().toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" }),
      motif: message,
      lieuPanne: equipement ? [equipement.nom, equipement.localisation].filter(Boolean).join(" — ") : "",
      numeroDemandeClient: "",
      intervenant: "",
      dateInterventionPrevue: "",
      codePostal: s?.code_postal ?? "",
      commune: s?.commune ?? "",
      adresse: s?.adresse ?? "",
      interlocuteurSite: s?.interlocuteur_site ?? "",
      tel1: telInternational(s?.tel_fixe_interlocuteur_site ?? ""),
      tel2: telInternational(s?.portable_interlocuteur_site ?? ""),
      informationComplementaire: "",
    });
    await admin.from("demandes_depannage").update({ accuse_envoye_le: new Date().toISOString() }).eq("id", creee.id);
    accuseEnvoye = true;
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: `Accusé de réception non envoyé — demande N°${numero} (${origine})`,
      detail: `${site.nom} — ${site.site} · ${email}\n${messageErreur(e)}`,
      objetType: "depannage",
      objetId: creee.id,
      lien: `/depannages/${creee.id}`,
    });
  }

  return { ok: true, numero: String(numero), accuseEnvoye };
}

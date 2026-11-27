"use server";

import { messageErreur, signalerIncident } from "@/lib/incidents";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargerEquipementEtSite, emailConnuDuSite, type EquipementPublicDonnees } from "@/lib/gmao/depannage";
import { envoyerNotificationDepannage } from "@/lib/gmao/depannage-email";
import { envoyerConfirmationDepannage } from "@/lib/gmao/depannage-confirmation-email";
import { telInternational } from "@/lib/format";
import { prochainChrono } from "@/lib/gmao/chrono";

export type ResultatVerification =
  | { ok: true; donnees: EquipementPublicDonnees }
  | { ok: false; erreur: string };

/// Callable public : vérifie que l'email saisi par la personne qui
/// scanne le QR code est connu du site propriétaire de l'équipement, et
/// renvoie alors ses données. Port de `verifierAccesEquipement`
/// (functions/index.js) — aucun accès Supabase direct côté client,
/// tout passe par cette Server Action et la suivante.
export async function verifierAccesEquipement(codeQr: string, email: string): Promise<ResultatVerification> {
  if (!email.trim() || !email.includes("@")) {
    return { ok: false, erreur: "Merci de saisir une adresse email valide." };
  }

  const admin = createAdminClient();
  const chargement = await chargerEquipementEtSite(admin, codeQr);
  if (!chargement.ok) return chargement;

  const connu = await emailConnuDuSite(admin, chargement.donnees.site, email);
  if (!connu) {
    return {
      ok: false,
      erreur:
        "Cette adresse email n'est pas reconnue pour ce site. Vérifiez qu'elle correspond bien à l'adresse connue d'OGEC Services pour ce contrat.",
    };
  }
  return { ok: true, donnees: chargement.donnees };
}

export type ResultatDemande = { ok: true; numero: string; accuseEnvoye: boolean } | { ok: false; erreur: string };

/// Callable public : enregistre une demande de dépannage. Revalide
/// l'email (défense en profondeur, indépendante de
/// verifierAccesEquipement), historise la demande dans la fiche
/// équipement, l'enregistre pour le suivi bureau, et notifie par email.
/// Port de `soumettreDemandeDepannage` (functions/index.js).
export async function soumettreDemandeDepannage(
  codeQr: string,
  email: string,
  message: string,
): Promise<ResultatDemande> {
  const messageTrim = message.trim();
  if (!messageTrim) return { ok: false, erreur: "Merci de décrire la panne rencontrée." };

  const admin = createAdminClient();
  const chargement = await chargerEquipementEtSite(admin, codeQr);
  if (!chargement.ok) return chargement;

  const connu = await emailConnuDuSite(admin, chargement.donnees.site, email);
  if (!connu) {
    return { ok: false, erreur: "Cette adresse email n'est pas reconnue pour ce site." };
  }

  const { equipement, site } = chargement.donnees;
  const numero = await prochainChrono(admin, "depannage");

  const { data: creee, error: errInsert } = await admin.from("demandes_depannage").insert({
    numero,
    equipement_id: equipement.id,
    site_id: site.id,
    client_nom: site.nom,
    client_site: site.site,
    equipement_nom: equipement.nom,
    email,
    message: messageTrim,
    statut: "nouvelle",
  }).select("id").single();
  if (errInsert || !creee) return { ok: false, erreur: "L'envoi a échoué, merci de réessayer dans un instant." };

  const dateLisible = new Date().toLocaleString("fr-FR", { timeZone: "Indian/Reunion" });
  const noteHistorique = `Demande de dépannage reçue le ${dateLisible} (${email})\n${messageTrim}`;
  const { data: remarqueActuelle } = await admin.from("equipements").select("remarque_technicien").eq("id", equipement.id).single();
  const existante = remarqueActuelle?.remarque_technicien ?? "";
  const nouvelleRemarque = existante ? `${existante}\n---\n${noteHistorique}` : noteHistorique;
  await admin.from("equipements").update({ remarque_technicien: nouvelleRemarque }).eq("id", equipement.id);

  try {
    await envoyerNotificationDepannage({
      clientNom: site.nom,
      clientSite: site.site,
      equipementNom: equipement.nom,
      email,
      message: messageTrim,
    });
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: `Demande de dépannage N°${numero} (QR) : mail au bureau non envoyé`,
      detail: `${site.nom} — ${site.site} · ${equipement.nom} · ${email}
${messageTrim}

${messageErreur(e)}`,
      objetType: "equipement",
      objetId: equipement.id,
      lien: "/depannages",
    });
  }

  // Accusé de réception au déclarant : même tableau de prise en compte que
  // pour une demande créée au bureau (les lignes encore inconnues, comme
  // l'intervenant, n'apparaissent pas). Le bureau garde son envoi « prise
  // en compte » complet une fois l'intervention planifiée.
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
      motif: messageTrim,
      lieuPanne: [equipement.nom, equipement.localisation].filter(Boolean).join(" — "),
      numeroDemandeClient: "",
      intervenant: "",
      dateInterventionPrevue: "",
      codePostal: s?.code_postal ?? "",
      commune: s?.commune ?? "",
      adresse: s?.adresse ?? "",
      interlocuteurSite: s?.interlocuteur_site ?? "",
      tel1: telInternational(s?.tel_fixe_interlocuteur_site ?? ""),
      tel2: telInternational(s?.portable_interlocuteur_site ?? ""),
      informationComplementaire: "Demande enregistrée. Nous revenons vers vous pour planifier l'intervention.",
    });
    await admin.from("demandes_depannage").update({ accuse_envoye_le: new Date().toISOString() }).eq("id", creee.id);
    accuseEnvoye = true;
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: `Accusé de réception non envoyé — demande N°${numero} (QR)`,
      detail: `${site.nom} — ${site.site} · ${email}\n${messageErreur(e)}`,
      objetType: "depannage",
      objetId: creee.id,
      lien: `/depannages/${creee.id}`,
    });
  }

  return { ok: true, numero: String(numero), accuseEnvoye };
}

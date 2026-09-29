"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { chargerEquipementEtSite, emailConnuDuSite, type EquipementPublicDonnees } from "@/lib/gmao/depannage";
import { envoyerNotificationDepannage } from "@/lib/gmao/depannage-email";

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
    return { ok: false, erreur: "Merci de saisir un email valide." };
  }

  const admin = createAdminClient();
  const chargement = await chargerEquipementEtSite(admin, codeQr);
  if (!chargement.ok) return chargement;

  const connu = await emailConnuDuSite(admin, chargement.donnees.site, email);
  if (!connu) {
    return {
      ok: false,
      erreur:
        "Cet email n'est pas reconnu pour ce site. Vérifie qu'il correspond bien à l'adresse déjà connue d'OGEC Services pour ce contrat.",
    };
  }
  return { ok: true, donnees: chargement.donnees };
}

export type ResultatDemande = { ok: true } | { ok: false; erreur: string };

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
    return { ok: false, erreur: "Cet email n'est pas reconnu pour ce site." };
  }

  const { equipement, site } = chargement.donnees;

  const { error: errInsert } = await admin.from("demandes_depannage").insert({
    equipement_id: equipement.id,
    site_id: site.id,
    client_nom: site.nom,
    client_site: site.site,
    equipement_nom: equipement.nom,
    email,
    message: messageTrim,
    statut: "nouvelle",
  });
  if (errInsert) return { ok: false, erreur: "L'envoi a échoué, réessaie dans un instant." };

  const dateLisible = new Date().toLocaleString("fr-FR", { timeZone: "Indian/Reunion" });
  const noteHistorique = `Demande de dépannage reçue le ${dateLisible} (${email})\n${messageTrim}`;
  const nouvelleRemarque = equipement.remarque_technicien
    ? `${equipement.remarque_technicien}\n---\n${noteHistorique}`
    : noteHistorique;
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
    console.error("Échec envoi email demande de dépannage", e);
  }

  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { consommerLien, creerLien, emailConnecte, emailValide, fermerSession, normaliserEmail, siteDuClient, sitesAutorises } from "@/lib/espace-client/acces";
import { enregistrerDemandeClient, type ResultatDemande } from "@/lib/gmao/demande-client";
import { envoyerAccordDevis, envoyerLienConnexion } from "@/lib/espace-client/email";
import { genererBonPourAccord } from "@/lib/espace-client/bon-pour-accord";
import { BUCKET_COMMANDES, fichiersCommandeClient } from "@/lib/devis/commande-client";
import { revalidatePath } from "next/cache";
import { messageErreur, signalerIncident } from "@/lib/incidents";

/// Demande de lien de connexion. Réponse identique que l'adresse ait un
/// accès ou non, pour ne rien révéler.
export async function demanderLienConnexion(email: string): Promise<{ ok: true }> {
  const adresse = normaliserEmail(email);
  if (!emailValide(adresse)) return { ok: true };
  const admin = createAdminClient();
  if ((await sitesAutorises(admin, adresse)).length === 0) return { ok: true };
  try {
    const jeton = await creerLien(admin, adresse);
    if (jeton) await envoyerLienConnexion(adresse, jeton);
  } catch (e) {
    await signalerIncident({ source: "mail", titre: "Mon contrat OGEC : lien de connexion non envoyé", detail: `${adresse}\n${messageErreur(e)}` });
  }
  return { ok: true };
}

export async function seConnecter(jeton: string): Promise<{ ok: false; erreur: string }> {
  const resultat = await consommerLien(createAdminClient(), jeton);
  if (!resultat.ok) {
    return { ok: false, erreur: "Ce lien a expiré ou a déjà servi. Demandez un nouveau lien de connexion." };
  }
  redirect("/mon-contrat/sites");
}

export async function seDeconnecter(): Promise<void> {
  await fermerSession(createAdminClient());
  redirect("/mon-contrat");
}

/// « Déclarer une panne » depuis Mon contrat OGEC : l'adresse est celle du
/// client connecté, le site et l'équipement sont revérifiés.
export async function declarerPanne(siteId: string, equipementId: string | null, message: string): Promise<ResultatDemande> {
  if (!message.trim()) return { ok: false, erreur: "Merci de décrire la panne rencontrée." };
  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) return { ok: false, erreur: "Votre session a expiré : reconnectez-vous." };
  const site = await siteDuClient(admin, email, siteId);
  if (!site) return { ok: false, erreur: "Site introuvable." };
  let equipement: { id: string; nom: string; localisation: string } | null = null;
  if (equipementId) {
    const { data } = await admin.from("equipements").select("id, nom, localisation").eq("id", equipementId).eq("site_id", siteId).maybeSingle();
    if (!data) return { ok: false, erreur: "Équipement introuvable." };
    equipement = data;
  }
  return enregistrerDemandeClient(admin, { site, equipement, email, message, origine: "Mon contrat OGEC" });
}

/// « Bon pour accord » signé en ligne : le devis passe « Commandé », le PDF
/// signé rejoint ses commandes client, le client et le bureau sont prévenus.
export async function accepterDevis(
  siteId: string,
  devisId: string,
  saisie: { nom: string; qualite: string; signature: string; conditions: boolean },
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const nom = saisie.nom.trim();
  if (!nom) return { ok: false, erreur: "Indiquez votre nom." };
  if (!saisie.conditions) return { ok: false, erreur: "Cochez la case d'acceptation du devis et des conditions générales." };
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(saisie.signature);
  if (!m) return { ok: false, erreur: "Signez dans le cadre prévu." };
  const signaturePng = Buffer.from(m[1], "base64");
  if (signaturePng.length > 600_000) return { ok: false, erreur: "Signature trop volumineuse." };

  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) return { ok: false, erreur: "Votre session a expiré : reconnectez-vous." };
  const site = await siteDuClient(admin, email, siteId);
  if (!site) return { ok: false, erreur: "Site introuvable." };

  const { data: devis } = await admin.from("devis").select("*").eq("id", devisId).eq("site_id", siteId).maybeSingle();
  if (!devis || !devis.numero || devis.annule) return { ok: false, erreur: "Devis introuvable." };
  if (devis.date_commande_client) return { ok: false, erreur: "Ce devis est déjà commandé." };
  if (devis.perdu_le) return { ok: false, erreur: "Ce devis n'est plus valable : contactez-nous." };
  const { count: bis } = await admin.from("bons_intervention").select("id", { count: "exact", head: true }).eq("devis_id", devisId).neq("statut", "brouillon");
  if (bis || devis.mois_facturation || devis.bi_reference_historique) return { ok: false, erreur: "Les travaux de ce devis sont déjà réalisés." };

  const signeLe = new Date();
  const pdf = await genererBonPourAccord({
    numeroDevis: devis.numero,
    objet: devis.libelle,
    dateDevis: devis.date_devis,
    client: site.nom,
    site: site.site,
    nom,
    qualite: saisie.qualite.trim(),
    email,
    signeLe,
    signaturePng,
  });
  const nomFichier = `Bon-pour-accord-${devis.numero.replace(/[^A-Za-z0-9-]+/g, "_")}.pdf`;
  const chemin = `${devisId}/${signeLe.getTime()}-${nomFichier}`;
  const { error: errUpload } = await admin.storage.from(BUCKET_COMMANDES).upload(chemin, pdf, { contentType: "application/pdf" });
  if (errUpload) return { ok: false, erreur: "Enregistrement impossible pour le moment, merci de réessayer." };

  const fichiers = [
    ...fichiersCommandeClient(devis.commande_client),
    { chemin, nom: nomFichier, type: "application/pdf", ajoute_le: signeLe.toISOString() },
  ];
  const { data: maj, error } = await admin
    .from("devis")
    .update({
      date_commande_client: signeLe.toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" }),
      reference_client: `Bon pour accord en ligne — ${nom}`,
      commande_client: fichiers,
      rappel_relance: false,
      prochaine_relance: null,
      updated_at: signeLe.toISOString(),
    })
    .eq("id", devisId)
    .eq("date_commande_client", "")
    .select("id");
  if (error || !maj?.length) return { ok: false, erreur: "Ce devis vient d'être modifié : rechargez la page." };

  await admin.from("accords_devis").insert({
    devis_id: devisId,
    numero_devis: devis.numero,
    email,
    nom,
    qualite: saisie.qualite.trim(),
    signe_le: signeLe.toISOString(),
    pdf_chemin: chemin,
  });

  try {
    await envoyerAccordDevis({
      client: site.nom,
      emailClient: email,
      nom,
      qualite: saisie.qualite.trim(),
      numeroDevis: devis.numero,
      objet: devis.libelle,
      site: [site.nom, site.site].filter(Boolean).join(" — "),
      pdf,
      nomFichier,
    });
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: `Devis ${devis.numero} accepté en ligne : mail non envoyé`,
      detail: `${email}
${messageErreur(e)}`,
      objetType: "devis",
      objetId: devisId,
      lien: `/devis/${devisId}/statut`,
    });
  }
  revalidatePath(`/mon-contrat/sites/${siteId}`, "layout");
  return { ok: true };
}

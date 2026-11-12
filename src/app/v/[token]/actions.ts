"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { estJourOuvre } from "@/lib/planning/periode";
import { envoyerAccuseClient, envoyerAlerteBureau, type InfosDemande, type JourDemande } from "@/lib/planning/validation-email";

/// Page publique de validation d'un créneau par le client : seul le jeton
/// (aléatoire, impossible à deviner) donne accès à SA demande.

export type DemandePublique = {
  nom: string;
  infos: InfosDemande;
  statut: "attente" | "valide" | "autre_date" | "remplacee";
  expiree: boolean;
  datePropose: string | null;
  joursFeries: string[];
  demain: string;
};

const jetonValide = (t: string) => /^[0-9a-f-]{36}$/i.test(t);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

async function charger(token: string) {
  if (!jetonValide(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("demandes_validation_client").select("*").eq("token", token).single();
  return data ? { admin, d: data } : null;
}

function infosDe(d: { client_nom: string; site: string; objet: string; jours: unknown }): InfosDemande {
  return { client_nom: d.client_nom, site: d.site, objet: d.objet, jours: (d.jours as JourDemande[]) ?? [] };
}

export async function chargerDemandePublique(token: string): Promise<DemandePublique | null> {
  const r = await charger(token);
  if (!r) return null;
  const infos = infosDe(r.d);
  const derniere = infos.jours[infos.jours.length - 1]?.date ?? "";
  const { data: feries } = await r.admin.from("jours_feries").select("date").gte("date", aujourdhui());
  return {
    nom: r.d.destinataire_nom,
    infos,
    statut: r.d.statut as DemandePublique["statut"],
    expiree: Boolean(derniere) && derniere < aujourdhui(),
    datePropose: r.d.date_proposee,
    joursFeries: (feries ?? []).map((f) => f.date),
    demain: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  };
}

export async function repondreDemande(
  token: string,
  reponse: { accepte: true } | { accepte: false; date: string; moment: string; commentaire: string },
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const r = await charger(token);
  if (!r) return { ok: false, erreur: "Lien introuvable." };
  const { admin, d } = r;
  if (d.statut !== "attente") return { ok: false, erreur: "Cette proposition a déjà reçu une réponse." };
  const infos = infosDe(d);
  const derniere = infos.jours[infos.jours.length - 1]?.date ?? "";
  if (derniere && derniere < aujourdhui()) return { ok: false, erreur: "Cette proposition a expiré." };

  if (reponse.accepte) {
    const { error } = await admin
      .from("demandes_validation_client")
      .update({ statut: "valide", reponse_le: new Date().toISOString() })
      .eq("id", d.id)
      .eq("statut", "attente");
    if (error) return { ok: false, erreur: "Enregistrement impossible, réessayez plus tard." };
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reponse.date) || reponse.date <= aujourdhui()) return { ok: false, erreur: "Choisissez une date à venir." };
    const { data: feries } = await admin.from("jours_feries").select("date").eq("date", reponse.date);
    if (!estJourOuvre(reponse.date, (feries ?? []).map((f) => f.date))) return { ok: false, erreur: "Choisissez un jour de semaine, hors jour férié." };
    const moment = ["matin", "apres_midi"].includes(reponse.moment) ? reponse.moment : "";
    const { error } = await admin
      .from("demandes_validation_client")
      .update({
        statut: "autre_date",
        reponse_le: new Date().toISOString(),
        date_proposee: reponse.date,
        moment,
        commentaire: reponse.commentaire.trim().slice(0, 1000),
      })
      .eq("id", d.id)
      .eq("statut", "attente");
    if (error) return { ok: false, erreur: "Enregistrement impossible, réessayez plus tard." };
  }

  try {
    await envoyerAccuseClient({
      destinataire: d.destinataire_email,
      nom: d.destinataire_nom,
      infos,
      reponse: reponse.accepte ? "valide" : "autre_date",
      dateProposee: reponse.accepte ? undefined : reponse.date,
      moment: reponse.accepte ? undefined : reponse.moment,
    });
    await envoyerAlerteBureau({
      infos,
      evenement: reponse.accepte ? "valide" : "autre_date",
      destinataire: [d.destinataire_nom, d.destinataire_email].filter(Boolean).join(" — "),
      dateProposee: reponse.accepte ? null : reponse.date,
      moment: reponse.accepte ? undefined : reponse.moment,
      commentaire: reponse.accepte ? undefined : reponse.commentaire,
    });
  } catch {
    // La réponse est enregistrée ; seuls les mails ont échoué.
  }
  return { ok: true };
}

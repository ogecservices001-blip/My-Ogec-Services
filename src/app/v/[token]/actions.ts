"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { estJourOuvre, type DateProposee } from "@/lib/planning/periode";
import { ajouterHistorique } from "@/lib/planning/validation-historique";
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
  reponse: { accepte: true } | { accepte: false; dates: DateProposee[]; commentaire: string },
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
    const nbJours = Math.max(1, infos.jours.length);
    if (reponse.dates.length !== nbJours) return { ok: false, erreur: `Proposez ${nbJours} date${nbJours > 1 ? "s" : ""}.` };
    const { data: feries } = await admin.from("jours_feries").select("date").gte("date", aujourdhui());
    const listeFeries = (feries ?? []).map((f) => f.date);
    const dates: DateProposee[] = [];
    for (const [i, d] of reponse.dates.entries()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || d.date <= aujourdhui()) return { ok: false, erreur: `Jour ${i + 1} : choisissez une date à venir.` };
      if (!estJourOuvre(d.date, listeFeries)) return { ok: false, erreur: `Jour ${i + 1} : choisissez un jour de semaine, hors jour férié.` };
      if (i > 0 && d.date <= dates[i - 1].date) return { ok: false, erreur: `Le jour ${i + 1} doit être après le jour ${i}.` };
      dates.push({ date: d.date, moment: ["matin", "apres_midi"].includes(d.moment) ? d.moment : "" });
    }
    const { error } = await admin
      .from("demandes_validation_client")
      .update({
        statut: "autre_date",
        reponse_le: new Date().toISOString(),
        date_proposee: dates[0].date,
        moment: dates[0].moment,
        dates_proposees: dates,
        commentaire: reponse.commentaire.trim().slice(0, 1000),
      })
      .eq("id", d.id)
      .eq("statut", "attente");
    if (error) return { ok: false, erreur: "Enregistrement impossible, réessayez plus tard." };
  }

  await ajouterHistorique(admin, d.id, {
    evenement: reponse.accepte ? "reponse_valide" : "reponse_autre_date",
    par: [d.destinataire_nom, "client"].filter(Boolean).join(", "),
    detail: reponse.accepte
      ? undefined
      : [reponse.dates.map((x) => x.date.split("-").reverse().join("/") + (x.moment ? ` (${x.moment === "matin" ? "matin" : "après-midi"})` : "")).join(", "), reponse.commentaire.trim()]
          .filter(Boolean)
          .join(" — "),
  });

  try {
    await envoyerAccuseClient({
      destinataire: d.destinataire_email,
      nom: d.destinataire_nom,
      infos,
      reponse: reponse.accepte ? "valide" : "autre_date",
      proposees: reponse.accepte ? undefined : reponse.dates,
    });
    await envoyerAlerteBureau({
      infos,
      evenement: reponse.accepte ? "valide" : "autre_date",
      destinataire: [d.destinataire_nom, d.destinataire_email].filter(Boolean).join(" — "),
      proposees: reponse.accepte ? undefined : reponse.dates,
      commentaire: reponse.accepte ? undefined : reponse.commentaire,
    });
  } catch {
    // La réponse est enregistrée ; seuls les mails ont échoué.
  }
  return { ok: true };
}

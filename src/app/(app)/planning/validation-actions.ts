"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { cleIntervention, creneauxDesInterventions, type CreneauIntervention } from "@/lib/planning/intervention";
import { joursOuvresAPartirDe, lienValidation } from "@/lib/planning/validation";
import {
  envoyerConfirmationNouvelleDate,
  envoyerCopieInformation,
  envoyerDemande,
  messageParDefaut,
  type InfosDemande,
  type JourDemande,
} from "@/lib/planning/validation-email";

export type ContactClient = { role: string; nom: string; email: string };

export type PreparationDemande = {
  creneauIds: string[];
  infos: InfosDemande;
  contacts: ContactClient[];
  destinataire: ContactClient | null;
  message: string;
  demandeEnCours: { statut: string; envoyeLe: string; destinataire: string } | null;
};

type CreneauComplet = CreneauIntervention & { heure_debut: string | null; client_nom: string; site: string };

async function groupeDuCreneau(creneauId: string) {
  const supabase = await createClient();
  const { data: creneau } = await supabase
    .from("creneaux_planning")
    .select("id, site_id, devis_id, visite_numero, visite_annee, visite_total, date, heure_debut, client_nom, site")
    .eq("id", creneauId)
    .single();
  if (!creneau || !creneau.site_id) return null;
  const cle = cleIntervention(creneau);
  const groupe = (await creneauxDesInterventions(supabase, [creneau])).filter((c) => cleIntervention(c) === cle);
  const { data: details } = await supabase
    .from("creneaux_planning")
    .select("id, date, heure_debut")
    .in("id", groupe.map((c) => c.id))
    .order("date");
  let objet = "Intervention";
  if (creneau.devis_id) {
    const { data: devis } = await supabase.from("devis").select("numero, libelle").eq("id", creneau.devis_id).single();
    objet = `Travaux — devis ${[devis?.numero, devis?.libelle].filter(Boolean).join(" — ")}`;
  } else if (creneau.visite_numero) {
    objet = `Visite d'entretien ${creneau.visite_numero}/${creneau.visite_total ?? "?"} — ${creneau.visite_annee ?? ""} de votre contrat de maintenance`;
  } else {
    objet = "Visite d'entretien de votre contrat de maintenance";
  }
  const jours: JourDemande[] = [];
  for (const d of details ?? []) if (!jours.some((j) => j.date === d.date)) jours.push({ date: d.date, heure: d.heure_debut });
  return { supabase, creneau: creneau as CreneauComplet, cle, ids: (details ?? []).map((d) => d.id), infos: { client_nom: creneau.client_nom, site: creneau.site, objet, jours } };
}

export async function preparerDemandeValidation(creneauId: string): Promise<PreparationDemande | null> {
  await requireAdmin();
  const g = await groupeDuCreneau(creneauId);
  if (!g) return null;
  const { data: site } = await g.supabase
    .from("sites")
    .select("interlocuteur_site, courriel_interlocuteur_site, responsable_contrat, courriel_responsable, interlocuteur_facturation, courriel_interlocuteur_facturation, interlocuteur_tiers, courriel_tiers")
    .eq("id", g.creneau.site_id as string)
    .single();
  const contacts: ContactClient[] = site
    ? [
        { role: "Interlocuteur sur site", nom: site.interlocuteur_site, email: site.courriel_interlocuteur_site },
        { role: "Responsable du contrat", nom: site.responsable_contrat, email: site.courriel_responsable },
        { role: "Interlocuteur facturation", nom: site.interlocuteur_facturation, email: site.courriel_interlocuteur_facturation },
        { role: "Tiers", nom: site.interlocuteur_tiers, email: site.courriel_tiers },
      ].filter((c) => c.email?.trim())
    : [];
  const destinataire = contacts[0] ?? null;
  const { data: enCours } = await g.supabase
    .from("demandes_validation_client")
    .select("statut, envoye_le, destinataire_email")
    .eq("cle_intervention", g.cle)
    .neq("statut", "remplacee")
    .order("envoye_le", { ascending: false })
    .limit(1);
  const { count: anciennes } = await g.supabase
    .from("demandes_validation_client")
    .select("id", { count: "exact", head: true })
    .eq("cle_intervention", g.cle)
    .in("statut", ["valide", "remplacee"]);
  return {
    creneauIds: g.ids,
    infos: g.infos,
    contacts,
    destinataire,
    message: messageParDefaut(destinataire?.nom ?? "", g.infos, (anciennes ?? 0) > 0),
    demandeEnCours: enCours?.[0]
      ? { statut: enCours[0].statut, envoyeLe: enCours[0].envoye_le, destinataire: enCours[0].destinataire_email }
      : null,
  };
}

async function urlBase(): Promise<string | undefined> {
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host");
  return hote ? `${h.get("x-forwarded-proto") ?? "https"}://${hote}` : undefined;
}

export async function envoyerDemandeValidation(p: {
  creneauId: string;
  destinataireEmail: string;
  destinataireNom: string;
  copies: string[];
  message: string;
}): Promise<ActionResult> {
  const profile = await requireAdmin();
  const email = p.destinataireEmail.trim();
  const valide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  if (!valide(email)) return { ok: false, erreur: "Email du destinataire invalide." };
  const copies = [...new Set(p.copies.map((c) => c.trim()).filter(Boolean))].filter((c) => c.toLowerCase() !== email.toLowerCase());
  const mauvaise = copies.find((c) => !valide(c));
  if (mauvaise) return { ok: false, erreur: `Email en copie invalide : ${mauvaise}` };
  if (!p.message.trim()) return { ok: false, erreur: "Le texte du mail est vide." };

  const g = await groupeDuCreneau(p.creneauId);
  if (!g) return { ok: false, erreur: "Créneau introuvable ou sans site." };

  await g.supabase
    .from("demandes_validation_client")
    .update({ statut: "remplacee", motif_remplacement: "nouvelle_demande", traite_le: new Date().toISOString() })
    .eq("cle_intervention", g.cle)
    .neq("statut", "remplacee");
  await g.supabase
    .from("demandes_validation_client")
    .update({ motif_remplacement: "nouvelle_demande" })
    .eq("cle_intervention", g.cle)
    .in("motif_remplacement", ["modification", "replanification"]);

  const { data: demande, error } = await g.supabase
    .from("demandes_validation_client")
    .insert({
      cle_intervention: g.cle,
      site_id: g.creneau.site_id,
      creneau_ids: g.ids,
      client_nom: g.infos.client_nom,
      site: g.infos.site,
      objet: g.infos.objet,
      jours: g.infos.jours,
      destinataire_email: email,
      destinataire_nom: p.destinataireNom.trim(),
      copies,
      message: p.message.trim(),
      created_by: profile.id,
    })
    .select("id, token")
    .single();
  if (error || !demande) return { ok: false, erreur: error?.message ?? "Impossible d'enregistrer la demande." };

  try {
    await envoyerDemande({ destinataire: email, message: p.message.trim(), lien: lienValidation(demande.token, await urlBase()), infos: g.infos });
    await envoyerCopieInformation({ copies, destinataireNom: p.destinataireNom.trim(), infos: g.infos });
  } catch (e) {
    await g.supabase.from("demandes_validation_client").delete().eq("id", demande.id);
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi du mail." };
  }
  revalidatePath("/planning");
  return { ok: true };
}

export type ConflitDate = { date: string; technicien: string; motif: string };

/// Le bureau accepte la date proposée par le client : contrôle que les
/// techniciens sont libres (aucun autre client, aucune absence), puis déplace
/// les créneaux de l'intervention et confirme au client.
export async function accepterDateClient(demandeId: string): Promise<{ ok: true } | { ok: false; erreur: string; conflits?: ConflitDate[] }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: d } = await supabase.from("demandes_validation_client").select("*").eq("id", demandeId).single();
  if (!d || d.statut !== "autre_date" || !d.date_proposee) return { ok: false, erreur: "Cette demande n'a pas de date proposée à traiter." };

  const { data: creneaux } = await supabase
    .from("creneaux_planning")
    .select("id, date, heure_debut, creneau_techniciens(technicien_id, profiles(name))")
    .in("id", d.creneau_ids)
    .eq("annule", false)
    .order("date");
  if (!creneaux || creneaux.length === 0) return { ok: false, erreur: "Les créneaux de cette intervention n'existent plus." };

  const { data: feries } = await supabase.from("jours_feries").select("date");
  const anciennes = [...new Set(creneaux.map((c) => c.date))].sort();
  const nouvelles = joursOuvresAPartirDe(d.date_proposee, anciennes.length, (feries ?? []).map((f) => f.date));
  if (nouvelles.length < anciennes.length) return { ok: false, erreur: "Impossible de trouver des jours ouvrés à partir de cette date." };
  const correspondance = new Map(anciennes.map((a, i) => [a, nouvelles[i]]));

  const conflits: ConflitDate[] = [];
  for (const c of creneaux) {
    const cible = correspondance.get(c.date)!;
    const techs = (c.creneau_techniciens ?? []) as { technicien_id: string; profiles: { name: string } | { name: string }[] | null }[];
    if (techs.length === 0) continue;
    const { data: occupes } = await supabase
      .from("creneau_techniciens")
      .select("technicien_id, creneaux_planning!inner(id, date, annule, client_nom, site, site_id, poste_hors_client_id)")
      .in("technicien_id", techs.map((t) => t.technicien_id))
      .eq("creneaux_planning.date", cible)
      .eq("creneaux_planning.annule", false);
    for (const o of (occupes ?? []) as unknown as {
      technicien_id: string;
      creneaux_planning: { id: string; client_nom: string; site: string; site_id: string | null; poste_hors_client_id: string | null };
    }[]) {
      if (d.creneau_ids.includes(o.creneaux_planning.id)) continue;
      const t = techs.find((x) => x.technicien_id === o.technicien_id);
      const nom = (Array.isArray(t?.profiles) ? t?.profiles[0]?.name : t?.profiles?.name) ?? "Un technicien";
      const motif = o.creneaux_planning.site_id
        ? `déjà chez ${o.creneaux_planning.client_nom} — ${o.creneaux_planning.site}`
        : `${o.creneaux_planning.client_nom} (${o.creneaux_planning.site})`;
      if (!conflits.some((x) => x.date === cible && x.technicien === nom)) conflits.push({ date: cible, technicien: nom, motif });
    }
  }
  if (conflits.length > 0) return { ok: false, erreur: "Les techniciens ne sont pas libres à cette date.", conflits };

  for (const c of creneaux) {
    const { error } = await supabase.from("creneaux_planning").update({ date: correspondance.get(c.date)! }).eq("id", c.id);
    if (error) return { ok: false, erreur: error.message };
  }
  const jours: JourDemande[] = nouvelles.map((date, i) => ({ date, heure: creneaux.find((c) => c.date === anciennes[i])?.heure_debut ?? null }));
  await supabase
    .from("demandes_validation_client")
    .update({ statut: "valide", traite_le: new Date().toISOString(), jours })
    .eq("id", demandeId);
  try {
    await envoyerConfirmationNouvelleDate({
      destinataire: d.destinataire_email,
      nom: d.destinataire_nom,
      infos: { client_nom: d.client_nom, site: d.site, objet: d.objet, jours },
    });
  } catch {
    // Les créneaux sont déplacés ; seul le mail de confirmation a échoué.
  }
  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true };
}

/// Le bureau ne retient pas la date du client : la demande est close, le
/// bureau déplace lui-même les créneaux puis renvoie une demande.
export async function replanifierDemande(demandeId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("demandes_validation_client")
    .update({ statut: "remplacee", motif_remplacement: "replanification", traite_le: new Date().toISOString() })
    .eq("id", demandeId);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/planning");
  return { ok: true };
}

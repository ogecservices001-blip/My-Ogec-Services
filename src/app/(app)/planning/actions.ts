"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { creneauSchema, type CreneauInput } from "@/lib/validation/creneau";
import { quotaJournalier } from "@/lib/planning/quota";
import { envoyerAnnoncePassage } from "@/lib/planning/email";
import { chargerDepannagesPlanning, heuresDepannageDuJour } from "@/lib/planning/depannages";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { heuresEquipementVisiteSite } from "@/lib/gmao/calcul-heures-visite";
import type { ChampsEnTeteEquipement, ReferenceHoraire } from "@/lib/gmao/types";

/// Bureau et techniciens (lecture du planning général), jamais un compte client.
async function requireStaff() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "technicien") throw new Error("Accès réservé à l'équipe OGEC.");
  return profile;
}

export type CreneauAvecTechniciens = {
  id: string;
  site_id: string | null;
  devis_id: string | null;
  poste_hors_client_id: string | null;
  client_nom: string;
  site: string;
  date: string;
  heure_debut: string | null;
  heures_prevues: number;
  observations: string;
  visite_numero: number | null;
  visite_total: number | null;
  visite_annee: number | null;
  techniciens: { id: string; name: string }[];
};

/// Créneaux de la semaine, toutes familles confondues — vue bureau
/// uniquement (un technicien a sa propre requête filtrée, voir la page
/// "Mon planning").
export async function chargerCreneauxSemaine(debutISO: string, finISO: string): Promise<CreneauAvecTechniciens[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("creneaux_planning")
    .select(
      "id, site_id, devis_id, poste_hors_client_id, client_nom, site, date, heure_debut, heures_prevues, observations, visite_numero, visite_total, visite_annee, creneau_techniciens(technicien_id, profiles(id, name))",
    )
    .eq("annule", false)
    .gte("date", debutISO)
    .lte("date", finISO)
    .order("date");

  return (data ?? []).map((c) => ({
    id: c.id,
    site_id: c.site_id,
    devis_id: c.devis_id,
    poste_hors_client_id: c.poste_hors_client_id,
    client_nom: c.client_nom,
    site: c.site,
    date: c.date,
    heure_debut: c.heure_debut,
    heures_prevues: Number(c.heures_prevues),
    observations: c.observations,
    visite_numero: c.visite_numero,
    visite_total: c.visite_total,
    visite_annee: c.visite_annee,
    techniciens: (c.creneau_techniciens ?? []).flatMap((ct) =>
      (Array.isArray(ct.profiles) ? ct.profiles : ct.profiles ? [ct.profiles] : []) as { id: string; name: string }[],
    ),
  }));
}

export type TechnicienOption = { id: string; name: string };

/// Techniciens à qui on peut assigner du travail — "technicien" (compte
/// actif) ET "en_attente" (fiché mais sans compte de connexion encore,
/// même convention que l'assistant BI) : le bureau doit pouvoir
/// planifier tout le monde, pas seulement ceux qui ont déjà un accès à
/// l'appli. Jamais les admins (bureau), ni les comptes "client".
export async function chargerTechniciens(): Promise<TechnicienOption[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .in("role", ["technicien", "en_attente"])
    .order("name");
  return data ?? [];
}

export type PosteHorsClientOption = { id: string; client: string; site: string };

/// Référentiel des postes hors client (formation, bureau, absences...)
/// — fourni par le bureau, voir migration 0040.
export async function chargerPostesHorsClient(): Promise<PosteHorsClientOption[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("postes_hors_client").select("id, client, site, item").order("item");
  return data ?? [];
}

/// Somme des heures déjà planifiées pour un technicien, à une date —
/// pour comparer au quota journalier (voir src/lib/planning/quota.ts)
/// avant d'ajouter un nouveau créneau.
async function heuresDejaPlanifiees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  technicienId: string,
  date: string,
  creneauIdExclu?: string,
): Promise<number> {
  const { data } = await supabase
    .from("creneau_techniciens")
    .select("creneaux_planning!inner(id, date, heures_prevues, annule)")
    .eq("technicien_id", technicienId)
    .eq("creneaux_planning.date", date)
    .eq("creneaux_planning.annule", false);

  return ((data ?? []) as { creneaux_planning: { id: string; heures_prevues: number } }[])
    .filter((l) => l.creneaux_planning.id !== creneauIdExclu)
    .reduce((total, l) => total + Number(l.creneaux_planning.heures_prevues), 0);
}

/// Vérifie, pour chaque technicien du créneau, si l'ajout dépasse son
/// quota journalier (7.5h lun-jeu / 5h ven) — alerte non bloquante,
/// contrairement au jour férié/week-end (bloqué en base, voir migration
/// 0040, uniquement pour les interventions client).
export async function verifierQuota(
  technicienIds: string[],
  date: string,
  heuresPrevues: number,
  creneauIdExclu?: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data: techniciens } = await supabase.from("profiles").select("id, name").in("id", technicienIds);
  const quota = quotaJournalier(new Date(`${date}T00:00:00`));
  const depannages = await chargerDepannagesPlanning(supabase, date, date);

  const alertes: string[] = [];
  for (const t of techniciens ?? []) {
    const dejaPlanifie =
      (await heuresDejaPlanifiees(supabase, t.id, date, creneauIdExclu)) + heuresDepannageDuJour(depannages, t.id, date);
    const total = dejaPlanifie + heuresPrevues;
    if (total > quota) {
      alertes.push(`${t.name} aura ${total}h planifiées ce jour-là (quota ${quota}h).`);
    }
  }
  return alertes;
}

export async function verifierQuotaJours(
  technicienIds: string[],
  jours: { date: string; heures: number }[],
  creneauIdExclu?: string,
): Promise<string[]> {
  await requireAdmin();
  const alertes: string[] = [];
  for (const j of jours) {
    for (const a of await verifierQuota(technicienIds, j.date, j.heures, creneauIdExclu)) {
      alertes.push(`${j.date.split("-").reverse().join("/")} : ${a}`);
    }
  }
  return alertes;
}

async function enregistrerTechniciens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  creneauId: string,
  technicienIds: string[],
): Promise<string | null> {
  const { error } = await supabase
    .from("creneau_techniciens")
    .insert(technicienIds.map((technicien_id) => ({ creneau_id: creneauId, technicien_id })));
  return error?.message ?? null;
}

/// Un créneau par jour de la période, chacun avec tous les techniciens
/// choisis. Tout ou rien : si un jour échoue, les créneaux déjà créés sont
/// retirés.
export async function creerCreneaux(
  input: Omit<CreneauInput, "date" | "heures_prevues">,
  jours: { date: string; heures: number }[],
): Promise<{ ok: true; ids: string[] } | { ok: false; erreur: string }> {
  const profile = await requireAdmin();
  if (jours.length === 0) return { ok: false, erreur: "Aucun jour à planifier." };
  const lignes = [];
  for (const j of jours) {
    const parsed = creneauSchema.safeParse({ ...input, date: j.date, heures_prevues: j.heures });
    if (!parsed.success) return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
    lignes.push(parsed.data);
  }

  const supabase = await createClient();
  const ids: string[] = [];
  for (const v of lignes) {
    const { data: creneau, error } = await supabase
      .from("creneaux_planning")
      .insert({
        site_id: v.site_id,
        devis_id: v.devis_id,
        poste_hors_client_id: v.poste_hors_client_id,
        client_nom: v.client_nom,
        site: v.site,
        date: v.date,
        heure_debut: v.heure_debut,
        heures_prevues: v.heures_prevues,
        observations: v.observations,
        visite_numero: v.visite_numero,
        visite_total: v.visite_total,
        visite_annee: v.visite_annee,
        created_by: profile.id,
      })
      .select("id")
      .single();
    const erreur = error || !creneau ? (error?.message ?? `Impossible de créer le créneau du ${v.date}.`) : await enregistrerTechniciens(supabase, creneau.id, v.technicien_ids);
    if (creneau) ids.push(creneau.id);
    if (erreur) {
      if (ids.length) await supabase.from("creneaux_planning").delete().in("id", ids);
      return { ok: false, erreur: `${v.date.split("-").reverse().join("/")} : ${erreur}` };
    }
  }

  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true, ids };
}

export async function modifierCreneau(id: string, input: CreneauInput): Promise<ActionResult & { demandeAnnulee?: boolean }> {
  await requireAdmin();
  const parsed = creneauSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { data: avant } = await supabase.from("creneaux_planning").select("date, heure_debut").eq("id", id).single();
  const { error } = await supabase
    .from("creneaux_planning")
    .update({
      site_id: v.site_id,
      devis_id: v.devis_id,
      poste_hors_client_id: v.poste_hors_client_id,
      client_nom: v.client_nom,
      site: v.site,
      date: v.date,
      heure_debut: v.heure_debut,
      heures_prevues: v.heures_prevues,
      observations: v.observations,
      visite_numero: v.visite_numero,
      visite_total: v.visite_total,
      visite_annee: v.visite_annee,
    })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  await supabase.from("creneau_techniciens").delete().eq("creneau_id", id);
  const erreurTech = await enregistrerTechniciens(supabase, id, v.technicien_ids);
  if (erreurTech) return { ok: false, erreur: erreurTech };

  let demandeAnnulee = false;
  if (avant && (avant.date !== v.date || (avant.heure_debut ?? "").slice(0, 5) !== (v.heure_debut ?? "").slice(0, 5))) {
    const { data: annulees } = await supabase
      .from("demandes_validation_client")
      .update({ statut: "remplacee", motif_remplacement: "modification", traite_le: new Date().toISOString() })
      .contains("creneau_ids", [id])
      .neq("statut", "remplacee")
      .select("id");
    demandeAnnulee = (annulees ?? []).length > 0;
  }

  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true, demandeAnnulee };
}

export async function supprimerCreneau(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // .select() est indispensable ici : sans lui, une suppression bloquée
  // par une policy RLS renvoie error=null et 0 ligne affectée — un échec
  // totalement silencieux, impossible à distinguer d'un succès sans
  // vérifier le contenu réellement supprimé.
  const { data, error } = await supabase.from("creneaux_planning").delete().eq("id", id).select("id");
  if (error) return { ok: false, erreur: error.message };
  if (!data || data.length === 0) {
    return { ok: false, erreur: "Rien n'a été supprimé — droits insuffisants ou créneau déjà supprimé." };
  }
  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true };
}

export type CreneauMonPlanning = Omit<CreneauAvecTechniciens, "techniciens">;

/// "Mon planning" — filtré explicitement par technicien connecté (pas
/// seulement confiance en la RLS, pour que le résultat reste correct
/// même pour un admin qui visiterait cette page par curiosité).
export async function chargerMesCreneaux(debutISO: string, finISO: string): Promise<CreneauMonPlanning[]> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("creneau_techniciens")
    .select(
      "creneaux_planning!inner(id, site_id, devis_id, poste_hors_client_id, client_nom, site, date, heure_debut, heures_prevues, observations, visite_numero, visite_total, visite_annee, annule)",
    )
    .eq("technicien_id", profile.id)
    .eq("creneaux_planning.annule", false)
    .gte("creneaux_planning.date", debutISO)
    .lte("creneaux_planning.date", finISO);

  return (data ?? [])
    .flatMap((l) => (Array.isArray(l.creneaux_planning) ? l.creneaux_planning : l.creneaux_planning ? [l.creneaux_planning] : []))
    .map((c) => ({ ...c, heures_prevues: Number(c.heures_prevues) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type HeuresVisitePlanning = { tech: number; assistant: number; total: number };

export type InfoVisiteSite = {
  frequence: number;
  annee: number;
  heuresContrat: number;
  visites: { numero: number; faite: boolean; programmees: number; heures: HeuresVisitePlanning }[];
  prochaine: number | null;
  equipementsCalcules: number;
  equipementsSansHeures: number;
  email: string;
};

/// Pour un site sous contrat et une année : fréquence (la plus courante sur
/// son parc sous contrat), heures de chaque visite tirées du Référentiel
/// Heures équipement par équipement (visite 1 = colonne An, puis Sem / Tri /
/// Mens selon la séquence GMAO), visites déjà faites (BI validés) et heures
/// déjà programmées pour chacune.
export async function chargerInfoVisiteSite(siteId: string, annee: number, creneauxExclus: string[] = []): Promise<InfoVisiteSite | null> {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: site }, { data: equipements }, { data: creneaux }, { data: references }] = await Promise.all([
    supabase.from("sites").select("nb_heures_vendues, courriel_responsable").eq("id", siteId).single(),
    supabase.from("equipements").select("id, champs_en_tete").eq("site_id", siteId).eq("hors_contrat", false),
    supabase
      .from("creneaux_planning")
      .select("id, visite_numero, heures_prevues, creneau_techniciens(technicien_id)")
      .eq("site_id", siteId)
      .eq("visite_annee", annee)
      .eq("annule", false)
      .is("devis_id", null),
    supabase.from("references_horaires").select("*"),
  ]);
  if (!site) return null;

  const parc = (equipements ?? []).map((e) => {
    const champs = (e.champs_en_tete ?? {}) as ChampsEnTeteEquipement;
    const brut = champs.freqEntretienAnnuelle;
    const freq = typeof brut === "string" ? parseInt(brut, 10) : NaN;
    return { id: e.id, freq, reference: analyserReference(champs, (references ?? []) as ReferenceHoraire[]).reference };
  });

  const comptes = new Map<number, number>();
  for (const e of parc) if (Number.isFinite(e.freq) && e.freq >= 1 && e.freq <= 12) comptes.set(e.freq, (comptes.get(e.freq) ?? 0) + 1);
  const frequence = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;

  const calculables = parc.filter((e) => e.reference && Number.isFinite(e.freq) && e.freq >= 1);
  const heuresDe = (numero: number): HeuresVisitePlanning => {
    let tech = 0;
    let assistant = 0;
    for (const e of calculables) {
      const h = heuresEquipementVisiteSite(e.freq, frequence, numero, e.reference!);
      if (h) {
        tech += Number(h.heuresTech) || 0;
        assistant += Number(h.heuresAssistant) || 0;
      }
    }
    return { tech, assistant, total: tech + assistant };
  };

  const faites = new Set<number>();
  const ids = parc.map((e) => e.id);
  if (ids.length > 0) {
    const { data: visites } = await supabase.from("visites_entretien").select("visite_numero").eq("annee", annee).in("equipement_id", ids);
    for (const v of visites ?? []) faites.add(v.visite_numero);
  }

  const programmees = new Map<number, number>();
  for (const c of creneaux ?? []) {
    if (!c.visite_numero || creneauxExclus.includes(c.id)) continue;
    const nb = Math.max(1, (c.creneau_techniciens as unknown[] | null)?.length ?? 1);
    programmees.set(c.visite_numero, (programmees.get(c.visite_numero) ?? 0) + Number(c.heures_prevues) * nb);
  }

  const visites = Array.from({ length: frequence }, (_, i) => ({
    numero: i + 1,
    faite: faites.has(i + 1),
    programmees: programmees.get(i + 1) ?? 0,
    heures: heuresDe(i + 1),
  }));
  const prochaine =
    visites.find((v) => !v.faite && (v.heures.total <= 0 ? v.programmees === 0 : v.programmees < v.heures.total - 0.01))?.numero ?? null;

  return {
    frequence,
    annee,
    heuresContrat: parseFloat(String(site.nb_heures_vendues ?? "").replace(",", ".")) || 0,
    visites,
    prochaine,
    equipementsCalcules: calculables.length,
    equipementsSansHeures: parc.length - calculables.length,
    email: site.courriel_responsable ?? "",
  };
}

export type ConflitAbsence = { id: string; date: string; client_nom: string; site: string; techniciens: string[] };

/// Interventions client où un des techniciens est déjà programmé, sur les
/// jours où l'on veut poser son absence.
export async function chercherConflitsAbsence(technicienIds: string[], dates: string[]): Promise<ConflitAbsence[]> {
  await requireAdmin();
  if (technicienIds.length === 0 || dates.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("creneaux_planning")
    .select("id, date, client_nom, site, site_id, creneau_techniciens!inner(technicien_id, profiles(name))")
    .in("date", dates)
    .eq("annule", false)
    .not("site_id", "is", null)
    .in("creneau_techniciens.technicien_id", technicienIds)
    .order("date");
  return (data ?? []).map((c) => ({
    id: c.id,
    date: c.date,
    client_nom: c.client_nom,
    site: c.site,
    techniciens: (c.creneau_techniciens ?? []).flatMap((ct) =>
      ((Array.isArray(ct.profiles) ? ct.profiles : ct.profiles ? [ct.profiles] : []) as { name: string }[]).map((p) => p.name),
    ),
  }));
}

/// Annonce au client des dates de passage (sans les noms des techniciens).
export async function envoyerMailPlanning(creneauIds: string[], destinataire: string): Promise<ActionResult> {
  await requireAdmin();
  const email = destinataire.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erreur: "Adresse email invalide." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("creneaux_planning")
    .select("date, heure_debut, client_nom, site, devis_id, visite_numero, visite_total, visite_annee")
    .in("id", creneauIds)
    .order("date");
  if (!data || data.length === 0) return { ok: false, erreur: "Créneaux introuvables." };
  try {
    await envoyerAnnoncePassage({ destinataire: email, creneaux: data });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi." };
  }
  return { ok: true };
}

export async function chargerEmailSite(siteId: string): Promise<string> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("sites").select("courriel_responsable").eq("id", siteId).single();
  return data?.courriel_responsable ?? "";
}

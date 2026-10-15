"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { creneauSchema, type CreneauInput } from "@/lib/validation/creneau";
import { quotaJournalier } from "@/lib/planning/quota";

export type CreneauAvecTechniciens = {
  id: string;
  type_creneau: string;
  site_id: string | null;
  devis_id: string | null;
  client_nom: string;
  site: string;
  motif_absence: string;
  date: string;
  heure_debut: string | null;
  heures_prevues: number;
  observations: string;
  techniciens: { id: string; name: string }[];
};

/// Créneaux de la semaine, toutes familles confondues — vue bureau
/// uniquement (un technicien a sa propre requête filtrée, voir la page
/// "Mon planning").
export async function chargerCreneauxSemaine(debutISO: string, finISO: string): Promise<CreneauAvecTechniciens[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("creneaux_planning")
    .select(
      "id, type_creneau, site_id, devis_id, client_nom, site, motif_absence, date, heure_debut, heures_prevues, observations, creneau_techniciens(technicien_id, profiles(id, name))",
    )
    .eq("annule", false)
    .gte("date", debutISO)
    .lte("date", finISO)
    .order("date");

  return (data ?? []).map((c) => ({
    id: c.id,
    type_creneau: c.type_creneau,
    site_id: c.site_id,
    devis_id: c.devis_id,
    client_nom: c.client_nom,
    site: c.site,
    motif_absence: c.motif_absence,
    date: c.date,
    heure_debut: c.heure_debut,
    heures_prevues: Number(c.heures_prevues),
    observations: c.observations,
    techniciens: (c.creneau_techniciens ?? []).flatMap((ct) =>
      (Array.isArray(ct.profiles) ? ct.profiles : ct.profiles ? [ct.profiles] : []) as { id: string; name: string }[],
    ),
  }));
}

export type TechnicienOption = { id: string; name: string };

export async function chargerTechniciens(): Promise<TechnicienOption[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, name").eq("role", "technicien").order("name");
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
/// contrairement au jour férié/week-end qui est bloqué en base (voir
/// migration 0039).
export async function verifierQuota(
  technicienIds: string[],
  date: string,
  heuresPrevues: number,
  creneauIdExclu?: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data: techniciens } = await supabase.from("profiles").select("id, name").in("id", technicienIds);
  const quota = quotaJournalier(new Date(`${date}T00:00:00`));

  const alertes: string[] = [];
  for (const t of techniciens ?? []) {
    const dejaPlanifie = await heuresDejaPlanifiees(supabase, t.id, date, creneauIdExclu);
    const total = dejaPlanifie + heuresPrevues;
    if (total > quota) {
      alertes.push(`${t.name} aura ${total}h planifiées ce jour-là (quota ${quota}h).`);
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

export async function creerCreneau(input: CreneauInput): Promise<ActionResult> {
  const profile = await requireAdmin();
  const parsed = creneauSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { data: creneau, error } = await supabase
    .from("creneaux_planning")
    .insert({
      type_creneau: v.type_creneau,
      site_id: v.site_id,
      devis_id: v.devis_id,
      client_nom: v.client_nom,
      site: v.site,
      motif_absence: v.motif_absence,
      date: v.date,
      heure_debut: v.heure_debut,
      heures_prevues: v.heures_prevues,
      observations: v.observations,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !creneau) {
    return { ok: false, erreur: error?.message ?? "Impossible de créer le créneau (jour férié/week-end ?)." };
  }

  const erreurTech = await enregistrerTechniciens(supabase, creneau.id, v.technicien_ids);
  if (erreurTech) {
    await supabase.from("creneaux_planning").delete().eq("id", creneau.id);
    return { ok: false, erreur: erreurTech };
  }

  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true };
}

export async function modifierCreneau(id: string, input: CreneauInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = creneauSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("creneaux_planning")
    .update({
      type_creneau: v.type_creneau,
      site_id: v.site_id,
      devis_id: v.devis_id,
      client_nom: v.client_nom,
      site: v.site,
      motif_absence: v.motif_absence,
      date: v.date,
      heure_debut: v.heure_debut,
      heures_prevues: v.heures_prevues,
      observations: v.observations,
    })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  await supabase.from("creneau_techniciens").delete().eq("creneau_id", id);
  const erreurTech = await enregistrerTechniciens(supabase, id, v.technicien_ids);
  if (erreurTech) return { ok: false, erreur: erreurTech };

  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true };
}

export async function supprimerCreneau(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("creneaux_planning").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };
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
      "creneaux_planning!inner(id, type_creneau, site_id, devis_id, client_nom, site, motif_absence, date, heure_debut, heures_prevues, observations, annule)",
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

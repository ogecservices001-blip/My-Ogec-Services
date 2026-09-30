"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { numeroBI, currentYear, now } from "@/lib/bi/format";
import type { ActionResult } from "@/lib/action-result";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";

export type EquipementDuSite = {
  id: string;
  nom: string;
  numero_equipement: string;
  localisation: string;
  groupe: string;
  type_equipement_id: string;
  champs_en_tete: ChampsEnTeteEquipement;
};

export async function chargerEquipementsDuSite(siteId: string): Promise<EquipementDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, nom, numero_equipement, localisation, groupe, type_equipement_id, champs_en_tete")
    .eq("site_id", siteId)
    .order("nom");
  return (data ?? []) as EquipementDuSite[];
}

export type AffaireDuSite = {
  id: string;
  numero_devis: string;
  designation_prestations: string;
  numero_commande_client: string;
  date_commande_client: string;
  nature: string;
};

export async function chargerAffairesDuSite(siteId: string, natureFiltre?: string): Promise<AffaireDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  let requete = supabase
    .from("affaires")
    .select("id, numero_devis, designation_prestations, numero_commande_client, date_commande_client, nature")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (natureFiltre) requete = requete.eq("nature", natureFiltre);
  const { data } = await requete;
  return data ?? [];
}

export type PhotoInput = { type: string; storage_path: string; horodatage: string };
export type PrestaInput = { designation: string; quantite: string };
export type NonDesserviInput = { nom: string; motif: string };

export type BiInput = {
  pole: string;
  site_id: string;
  client_nom: string;
  site: string;
  adresse: string;
  email: string;
  hors_contrat: boolean;

  equipement_id: string | null;
  equipement_nom: string;
  equipement_groupe: string;
  equipement_localisation: string;

  affaire_id: string | null;
  affaire_numero_devis: string;
  affaire_numero_commande_client: string;
  affaire_date_commande_client: string;

  materiel_type_equipement_id: string | null;
  materiel_champs_en_tete: Record<string, string>;

  entretien_groupes: string[];
  entretien_non_desservis: NonDesserviInput[];

  date_debut: string;
  date_fin: string;
  date_intervention: string;
  temps_passe: string;

  techniciens: string[];
  technicien_signataire: string;

  compte_rendu: string;
  obs_tech: string;
  obs_client: string;

  prestas: PrestaInput[];
  photos: PhotoInput[];

  sig_tech: string;
  sig_client: string;
  signataire: string;
  signataire_tel_portable: string;
  signataire_tel_fixe: string;
};

/// Crée le bon d'intervention — un seul enregistrement terminal par
/// passage dans l'assistant (contrairement à la version Flutter, qui
/// permet de reprendre un brouillon local plus tard sur le même
/// appareil hors-ligne : ici, pas de couche de synchronisation locale,
/// donc un brouillon web reste consultable en lecture seule côté
/// bureau tant qu'il n'est pas repris et retransmis depuis un nouvel
/// assistant). Le chrono n'est alloué qu'ici, jamais avant.
export async function enregistrerBI(input: BiInput, statut: "brouillon" | "averif"): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const annee = currentYear();
  const chrono = await prochainChronoBI(supabase, annee);
  const numero = numeroBI(input.pole, annee, chrono);

  const { error } = await supabase.from("bons_intervention").insert({
    pole: input.pole,
    chrono,
    numero,
    statut,
    site_id: input.site_id,
    client_nom: input.client_nom,
    site: input.site,
    adresse: input.adresse,
    email: input.email,
    hors_contrat: input.hors_contrat,
    equipement_id: input.equipement_id,
    equipement_nom: input.equipement_nom,
    equipement_groupe: input.equipement_groupe,
    equipement_localisation: input.equipement_localisation,
    affaire_id: input.affaire_id,
    affaire_numero_devis: input.affaire_numero_devis,
    affaire_numero_commande_client: input.affaire_numero_commande_client,
    affaire_date_commande_client: input.affaire_date_commande_client,
    materiel_type_equipement_id: input.materiel_type_equipement_id,
    materiel_champs_en_tete: input.materiel_champs_en_tete,
    entretien_groupes: input.entretien_groupes,
    entretien_non_desservis: input.entretien_non_desservis,
    date_debut: input.date_debut,
    date_fin: input.date_fin,
    date_intervention: input.date_intervention,
    temps_passe: input.temps_passe,
    techniciens: input.techniciens,
    technicien_signataire: input.technicien_signataire,
    compte_rendu: input.compte_rendu,
    obs_tech: input.obs_tech,
    obs_client: input.obs_client,
    prestas: input.prestas,
    photos: input.photos,
    sig_tech: input.sig_tech,
    sig_client: input.sig_client,
    signataire: input.signataire,
    signataire_tel_portable: input.signataire_tel_portable,
    signataire_tel_fixe: input.signataire_tel_fixe,
    date_signature: statut === "averif" ? now() : "",
    created_by: profile.name,
    history:
      statut === "averif"
        ? [{ user: profile.name, date: now(), event: "Signé client · transmis au bureau pour vérification" }]
        : [],
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/bi");
  return { ok: true };
}

/// `prochain_chrono` est générique (clé + année) — même mécanisme que
/// les dépannages (voir @/lib/gmao/chrono), mais le numéro du BI se
/// formate différemment ("BI-pôle-année-NNNN" et non "année-N") donc
/// pas de réutilisation directe de `prochainChrono`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function prochainChronoBI(supabase: any, annee: number): Promise<number> {
  const { data, error } = await supabase.rpc("prochain_chrono", { p_cle: "BI", p_annee: annee });
  if (error || data === null || data === undefined) {
    throw new Error(error?.message ?? "Échec de l'attribution du numéro de bon.");
  }
  return data as number;
}

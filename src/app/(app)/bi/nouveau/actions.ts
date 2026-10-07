"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { numeroBI, currentYear, now } from "@/lib/bi/format";
import type { ActionResult } from "@/lib/action-result";
import type { ChampsEnTeteEquipement, ChampEnTete, ChecklistItem } from "@/lib/gmao/types";

export type ModeleBI = { champs: ChampEnTete[]; checklist: ChecklistItem[]; texte_type: string };

/// Modèle du pôle (voir Référentiel BI) — consulté en direct à chaque
/// création de BI, jamais mis en cache côté client au-delà de la
/// session de l'assistant.
export async function chargerModeleBI(pole: string): Promise<ModeleBI | null> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("bi_modeles").select("champs, checklist, texte_type").eq("pole", pole).maybeSingle();
  if (!data) return null;
  return { champs: data.champs as ChampEnTete[], checklist: data.checklist as ChecklistItem[], texte_type: data.texte_type };
}

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

export type DevisDuSite = {
  id: string;
  numero: string;
  libelle: string;
  reference_client: string;
  date_commande_client: string;
  nature: string;
};

/// Devis commandés (= Affaires) d'un site — un devis pas encore
/// commandé (date_commande_client vide) n'a rien à faire dans
/// l'assistant BI, qui ne concerne que du travail à réaliser.
export async function chargerDevisDuSite(siteId: string, natureFiltre?: string): Promise<DevisDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  let requete = supabase
    .from("devis")
    .select("id, numero, libelle, reference_client, date_commande_client, nature")
    .eq("site_id", siteId)
    .neq("date_commande_client", "")
    .eq("annule", false)
    .order("created_at", { ascending: false });
  if (natureFiltre) requete = requete.eq("nature", natureFiltre);
  const { data } = await requete;
  return data ?? [];
}

export type DevisARealiser = {
  id: string;
  numero: string;
  site_id: string;
  client_nom: string;
  client_site: string;
  nature: string;
  libelle: string;
};

const STATUTS_REALISE = new Set(["valide", "pdf", "prete", "envoye"]);

/// Devis commandés pas encore réalisés (aucun BI validé ne leur est
/// rattaché) — proposés à l'étape Pôle de l'assistant : les choisir
/// détermine le pôle (= la nature du devis) en plus du client, comme
/// pour les dépannages en cours (voir chargerDepannagesEnCours).
export async function chargerDevisARealiser(): Promise<DevisARealiser[]> {
  await requireProfile();
  const supabase = await createClient();
  const [{ data: devis }, { data: bons }, { data: sites }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, numero, site_id, nature, libelle, bi_reference_historique")
      .neq("date_commande_client", "")
      .neq("nature", "")
      .eq("annule", false)
      .order("created_at", { ascending: false }),
    supabase.from("bons_intervention").select("devis_id, statut").not("devis_id", "is", null),
    supabase.from("sites").select("id, nom, site"),
  ]);

  const devisRealises = new Set(
    (bons ?? []).filter((b) => STATUTS_REALISE.has(b.statut)).map((b) => b.devis_id as string),
  );
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));

  return (devis ?? [])
    .filter((d) => !devisRealises.has(d.id) && !d.bi_reference_historique)
    .map((d) => ({
      id: d.id,
      numero: d.numero,
      site_id: d.site_id,
      client_nom: siteParId.get(d.site_id)?.nom ?? "",
      client_site: siteParId.get(d.site_id)?.site ?? "",
      nature: d.nature,
      libelle: d.libelle,
    }));
}

export type DepannageEnCours = {
  id: string;
  numero: string;
  client_nom: string;
  client_site: string;
  site_id: string | null;
  message: string;
  lieu_panne: string;
  equipement_id: string | null;
  equipement_nom: string;
  intervenant_id: string | null;
  date_creation: string;
};

/// Dépannages pas encore liés à un BI, pour pré-remplir l'assistant au
/// pôle Dépannage (voir wizard.tsx) — tous les dépannages non traités,
/// pas seulement ceux du technicien connecté : un dépannage assigné à
/// un collègue reste utile à proposer si un autre technicien passe sur
/// le site en premier.
export async function chargerDepannagesEnCours(): Promise<DepannageEnCours[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("demandes_depannage")
    .select("id, numero, client_nom, client_site, site_id, message, lieu_panne, equipement_id, equipement_nom, intervenant_id, date_creation")
    .is("bon_intervention_id", null)
    .neq("statut", "traitee")
    .order("date_creation", { ascending: false });
  return data ?? [];
}

export type PhotoInput = { type: string; storage_path: string; horodatage: string };
export type PrestaInput = { designation: string; quantite: string };
export type NonDesserviInput = { nom: string; motif: string };
export type InterventionSupplementaireInput = {
  equipement_id: string | null;
  equipement_nom: string;
  equipement_groupe: string;
  equipement_localisation: string;
  compte_rendu: string;
  prestas: PrestaInput[];
};

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

  devis_id: string | null;
  devis_numero: string;
  devis_reference_client: string;
  devis_date_commande_client: string;

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

  /// Valeurs des champs guidés / de la checklist du modèle du pôle
  /// (voir chargerModeleBI) — vides si le pôle n'a pas de modèle.
  modele_champs: Record<string, string>;
  checklist_values: Record<string, boolean | string>;

  prestas: PrestaInput[];
  interventions_supplementaires: InterventionSupplementaireInput[];
  photos: PhotoInput[];

  sig_tech: string;
  sig_client: string;
  signataire: string;
  signataire_tel_portable: string;
  signataire_tel_fixe: string;

  /// Dépannage d'origine (voir chargerDepannagesEnCours) — non nul si
  /// l'assistant a été pré-rempli depuis un ticket : marqué "traitée"
  /// et lié au bon créé une fois l'insertion réussie.
  depannage_id: string | null;
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

  const { data: bi, error } = await supabase.from("bons_intervention").insert({
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
    devis_id: input.devis_id,
    devis_numero: input.devis_numero,
    devis_reference_client: input.devis_reference_client,
    devis_date_commande_client: input.devis_date_commande_client,
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
    modele_champs: input.modele_champs,
    checklist_values: input.checklist_values,
    prestas: input.prestas,
    interventions_supplementaires: input.interventions_supplementaires,
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
  }).select("id").single();
  if (error || !bi) return { ok: false, erreur: error?.message ?? "Échec de l'enregistrement." };

  // Le dépannage ne passe "traitée" qu'à la transmission réelle au
  // bureau — un simple brouillon enregistré par le technicien ne
  // ferme pas le ticket.
  if (input.depannage_id && statut === "averif") {
    await supabase
      .from("demandes_depannage")
      .update({ bon_intervention_id: bi.id, statut: "traitee", date_traitement: new Date().toISOString() })
      .eq("id", input.depannage_id);
    revalidatePath("/depannages");
  }

  revalidatePath("/bi");
  revalidatePath("/prestations");
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

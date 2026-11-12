"use server";

import { NATURE_MULTIPLE } from "@/lib/devis/paves";
import { interventionsDuBon } from "@/lib/bi/format";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { numeroBI, currentYear, now } from "@/lib/bi/format";
import { Poles } from "@/lib/bi/constants";
import { equipementsEntretenus, proposerVisite, type VisiteSaisie } from "@/lib/gmao/visites";
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
  hors_contrat: boolean;
};

export async function chargerEquipementsDuSite(siteId: string): Promise<EquipementDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, nom, numero_equipement, localisation, groupe, type_equipement_id, champs_en_tete, hors_contrat")
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
  date_devis: string;
  nature: string;
  equipement_id: string | null;
  equipements_supplementaires: string[];
  localisation: string;
  paves: unknown;
};

/// Devis commandés (= Affaires) d'un site — un devis pas encore
/// commandé (date_commande_client vide) n'a rien à faire dans
/// l'assistant BI, qui ne concerne que du travail à réaliser.
export async function chargerDevisDuSite(siteId: string, natureFiltre?: string): Promise<DevisDuSite[]> {
  await requireProfile();
  const supabase = await createClient();
  let requete = supabase
    .from("devis")
    .select("id, numero, libelle, reference_client, date_commande_client, date_devis, nature, equipement_id, equipements_supplementaires, localisation, paves")
    .eq("site_id", siteId)
    .neq("date_commande_client", "")
    .eq("annule", false)
    .order("created_at", { ascending: false });
  if (natureFiltre) requete = requete.in("nature", [natureFiltre, NATURE_MULTIPLE]);
  const { data } = await requete;
  return data ?? [];
}

export type InfosNouvelEquipement = { nom: string; localisation: string };

/// Pré-remplissage "Nom de l'équipement" et "Localisation" (pôle
/// Installation neuve) à partir du devis : soit de l'équipement
/// existant qu'il remplace/rejoint (ex: "SPLIT 06 (405-02-06) —
/// Médecin Conseil"), soit directement de `devis.localisation` quand
/// l'équipement n'existe pas encore dans le parc GMAO — le technicien
/// sait tout de suite où intervenir.
export async function chargerInfosNouvelEquipement(devisId: string): Promise<InfosNouvelEquipement | null> {
  await requireProfile();
  const supabase = await createClient();

  const { data: devis } = await supabase.from("devis").select("equipement_id, localisation").eq("id", devisId).single();
  if (!devis) return null;

  if (!devis.equipement_id) {
    return devis.localisation ? { nom: "", localisation: devis.localisation } : null;
  }

  const { data: equipement } = await supabase
    .from("equipements")
    .select("nom, numero_equipement, localisation")
    .eq("id", devis.equipement_id)
    .single();
  if (!equipement) return devis.localisation ? { nom: "", localisation: devis.localisation } : null;

  const identite = [equipement.nom, equipement.numero_equipement ? `(${equipement.numero_equipement})` : ""]
    .filter(Boolean)
    .join(" ");
  const nom = [identite, equipement.localisation].filter(Boolean).join(" — ");
  const localisation = devis.localisation || equipement.localisation;
  return nom || localisation ? { nom, localisation } : null;
}

export type DevisARealiser = {
  id: string;
  numero: string;
  site_id: string;
  client_nom: string;
  client_site: string;
  nature: string;
  libelle: string;
  equipement_id: string | null;
  localisation: string;
  paves: unknown;
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
      .select("id, numero, site_id, nature, libelle, bi_reference_historique, equipement_id, localisation, paves")
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
      equipement_id: d.equipement_id,
      localisation: d.localisation,
      paves: d.paves,
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
  etat_equipement: string[];
  materiel_champs_en_tete?: Record<string, string>;
  materiel_type_equipement_id?: string | null;
  pole?: string;
  modele_champs?: Record<string, string>;
  checklist_values?: Record<string, boolean | string>;
};

export type BiInput = {
  creneau_id?: string | null;
  /// Type de la première page d'un BI à plusieurs pages (pole = PN), sinon vide.
  pole_principal: string;
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
  devis_date_devis: string;

  materiel_type_equipement_id: string | null;
  materiel_champs_en_tete: Record<string, string>;

  entretien_groupes: string[];
  entretien_non_desservis: NonDesserviInput[];
  /// Entretien sous contrat : visite saisie par le technicien ("1 de 2 — 2026").
  visite_numero?: number | null;
  visite_total?: number | null;
  visite_annee?: number | null;

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
  etat_equipement: string[];
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

  /// Confirmé juste avant transmission au bureau (voir modale dans
  /// l'assistant), par défaut 1.
  nombre_deplacements: number;
};

export type BrouillonBI = {
  id: string;
  pole: string;
  site_id: string;
  depannage_id: string | null;
  creneau_id: string | null;
  equipement_id: string | null;
  equipement_nom: string;
  equipement_groupe: string;
  equipement_localisation: string;
  devis_id: string | null;
  materiel_type_equipement_id: string | null;
  materiel_champs_en_tete: Record<string, string>;
  entretien_groupes: string[];
  entretien_non_desservis: NonDesserviInput[];
  visite_numero: number | null;
  visite_total: number | null;
  visite_annee: number | null;
  date_debut: string;
  date_fin: string;
  date_intervention: string;
  temps_passe: string;
  techniciens: string[];
  compte_rendu: string;
  obs_tech: string;
  obs_client: string;
  modele_champs: Record<string, string>;
  checklist_values: Record<string, boolean | string>;
  prestas: PrestaInput[];
  etat_equipement: string[];
  interventions_supplementaires: InterventionSupplementaireInput[];
  photos: (PhotoInput & { preview: string })[];
  signataire: string;
  signataire_tel_portable: string;
  signataire_tel_fixe: string;
  email: string;
  nombre_deplacements: number;
};

/// Charge un brouillon BI pour le reprendre dans l'assistant (voir
/// "Reprendre le BI" sur /prestations) — tout ce qui a déjà été saisi
/// doit revenir tel quel, le technicien ne doit rien ressaisir. Les
/// photos déjà envoyées sont dans un bucket privé : on génère une URL
/// signée pour pouvoir les réafficher (le chemin seul ne suffit pas).
/// Ne récupère jamais un BI déjà transmis (statut différent de
/// "brouillon") — cet écran ne sert qu'à reprendre un brouillon.
export async function chargerBrouillonBI(id: string): Promise<BrouillonBI | null> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("bons_intervention").select("*").eq("id", id).eq("statut", "brouillon").single();
  if (!data) return null;

  // BI à plusieurs pages : l'assistant reprend sur la dernière page saisie,
  // les précédentes redevenant des pages déjà faites.
  const pages = data.pole === NATURE_MULTIPLE ? interventionsDuBon(data) : [];
  const derniere = pages[pages.length - 1];
  const reprisePage = derniere
    ? {
        pole: derniere.pole ?? "",
        equipement_id: derniere.equipement_id,
        equipement_nom: derniere.equipement_nom,
        equipement_groupe: derniere.equipement_groupe,
        equipement_localisation: derniere.equipement_localisation,
        materiel_type_equipement_id: derniere.materiel_type_equipement_id ?? null,
        materiel_champs_en_tete: derniere.materiel_champs_en_tete ?? {},
        compte_rendu: derniere.compte_rendu,
        modele_champs: derniere.modele_champs ?? {},
        checklist_values: derniere.checklist_values ?? {},
        interventions_supplementaires: pages.slice(0, -1) as InterventionSupplementaireInput[],
      }
    : {};

  const photosBrutes = data.photos as unknown as PhotoInput[];
  const photos = await Promise.all(
    photosBrutes.map(async (p) => {
      const { data: signee } = await supabase.storage.from("bi-photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, preview: signee?.signedUrl ?? "" };
    }),
  );

  return {
    id: data.id,
    pole: data.pole,
    site_id: data.site_id ?? "",
    depannage_id: data.depannage_id,
    creneau_id: data.creneau_id,
    equipement_id: data.equipement_id,
    equipement_nom: data.equipement_nom,
    equipement_groupe: data.equipement_groupe,
    equipement_localisation: data.equipement_localisation,
    devis_id: data.devis_id,
    materiel_type_equipement_id: data.materiel_type_equipement_id,
    materiel_champs_en_tete: data.materiel_champs_en_tete as unknown as Record<string, string>,
    entretien_groupes: data.entretien_groupes,
    entretien_non_desservis: data.entretien_non_desservis as unknown as NonDesserviInput[],
    visite_numero: data.visite_numero,
    visite_total: data.visite_total,
    visite_annee: data.visite_annee,
    date_debut: data.date_debut,
    date_fin: data.date_fin,
    date_intervention: data.date_intervention,
    temps_passe: data.temps_passe,
    techniciens: data.techniciens,
    compte_rendu: data.compte_rendu,
    obs_tech: data.obs_tech,
    obs_client: data.obs_client,
    modele_champs: data.modele_champs as unknown as Record<string, string>,
    checklist_values: data.checklist_values as unknown as Record<string, boolean | string>,
    prestas: data.prestas as unknown as PrestaInput[],
    etat_equipement: data.etat_equipement as unknown as string[],
    interventions_supplementaires: data.interventions_supplementaires as unknown as InterventionSupplementaireInput[],
    photos,
    signataire: data.signataire,
    signataire_tel_portable: data.signataire_tel_portable,
    signataire_tel_fixe: data.signataire_tel_fixe,
    email: data.email,
    nombre_deplacements: data.nombre_deplacements,
    ...reprisePage,
  };
}

/// Crée ou met à jour le bon d'intervention. `brouillonId` : reprise
/// d'un brouillon déjà enregistré (voir /prestations "Reprendre le
/// BI") — met à jour la même ligne plutôt que d'en créer une nouvelle,
/// pour qu'un technicien puisse enregistrer plusieurs fois de suite
/// sans multiplier les BI. Le numéro officiel n'est attribué qu'à la
/// transmission réelle au bureau (statut "averif", signé par le
/// client) — jamais sur un brouillon, qui n'en a pas besoin et ne doit
/// surtout pas en consommer un à chaque sauvegarde intermédiaire.
export async function enregistrerBI(
  input: BiInput,
  statut: "brouillon" | "averif",
  brouillonId?: string,
): Promise<ActionResult & { id?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let chrono = 0;
  let numero = "";
  if (statut === "averif") {
    const annee = currentYear();
    chrono = await prochainChronoBI(supabase, annee);
    numero = numeroBI(input.pole, annee, chrono);
  }

  const donnees = {
    pole: input.pole,
    pole_principal: input.pole_principal,
    chrono,
    numero,
    statut,
    ...(input.pole === Poles.entretienSousContrat ? { classement: "maintenance" } : {}),
    site_id: input.site_id,
    depannage_id: input.depannage_id,
    creneau_id: input.creneau_id ?? null,
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
    devis_date_devis: input.devis_date_devis,
    materiel_type_equipement_id: input.materiel_type_equipement_id,
    materiel_champs_en_tete: input.materiel_champs_en_tete,
    entretien_groupes: input.entretien_groupes,
    entretien_non_desservis: input.entretien_non_desservis,
    ...(input.pole === Poles.entretienSousContrat
      ? {
          visite_numero: input.visite_numero ?? null,
          visite_total: input.visite_total ?? null,
          visite_annee: input.visite_annee ?? null,
        }
      : {}),
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
    etat_equipement: input.etat_equipement,
    interventions_supplementaires: input.interventions_supplementaires,
    photos: input.photos,
    sig_tech: input.sig_tech,
    sig_client: input.sig_client,
    signataire: input.signataire,
    signataire_tel_portable: input.signataire_tel_portable,
    signataire_tel_fixe: input.signataire_tel_fixe,
    nombre_deplacements: input.nombre_deplacements,
    date_signature: statut === "averif" ? now() : "",
    created_by: profile.name,
    history:
      statut === "averif"
        ? [{ user: profile.name, date: now(), event: "Signé client · transmis au bureau pour vérification" }]
        : [],
  };

  const { data: bi, error } = brouillonId
    ? await supabase.from("bons_intervention").update(donnees).eq("id", brouillonId).select("id").single()
    : await supabase.from("bons_intervention").insert(donnees).select("id").single();
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
  return { ok: true, id: bi.id };
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

/// Visite proposée au technicien dans le BI Entretien sous contrat : visites
/// déjà validées cette année sur les équipements cochés + 1, fréquence du site.
export async function proposerVisiteBI(params: {
  siteId: string;
  groupes: string[];
  nonDesservis: string[];
  dateDebut: string;
  dateFin: string;
}): Promise<VisiteSaisie> {
  await requireProfile();
  const supabase = await createClient();
  const entretenus = await equipementsEntretenus(supabase, {
    site_id: params.siteId,
    entretien_groupes: params.groupes,
    entretien_non_desservis: params.nonDesservis.map((nom) => ({ nom })),
  });
  return proposerVisite(supabase, { date_debut: params.dateDebut, date_fin: params.dateFin }, entretenus);
}

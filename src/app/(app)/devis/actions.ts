"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { NATURES_DEVIS_SELECTIONNABLES } from "@/lib/devis/constants";
import {
  formaterNumeroDevis,
  initialesDe,
  numeroAffaireDuSite,
  prochainChrono,
} from "@/lib/devis/numerotation";
import { calculerPrixRevient, totalHTLignes, type LigneDevis, type CoutRevient } from "@/lib/devis/pricing";

export type NouveauDevisInput = {
  siteId: string;
  libelle: string;
  nature: string;
  equipementId: string | null;
  /// Texte libre, indépendant de l'équipement du parc GMAO — utile
  /// notamment pour une Installation neuve (l'équipement n'existe pas
  /// encore). Pré-remplie depuis l'équipement choisi, mais modifiable.
  localisation: string;
  lignes: LigneDevis[];
  coutRevient: CoutRevient;
  /// Brouillon existant ("Devis en cours") qu'on finalise — le numéro
  /// officiel lui est alors attribué par mise à jour, pas par insertion
  /// d'une nouvelle ligne.
  brouillonId?: string;
};

const ERREUR_DOUBLON = "23505";
const ESSAIS_NUMERO = 5;

export async function listerEquipementsDuSite(
  siteId: string,
): Promise<{ id: string; libelle: string; localisation: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, numero_equipement, localisation, champs_en_tete")
    .eq("site_id", siteId)
    .order("nom");
  return (data ?? []).map((e) => {
    const typeEquipement1 = typeof e.champs_en_tete.typeEquipement1 === "string" ? e.champs_en_tete.typeEquipement1 : "";
    return {
      id: e.id,
      libelle: [typeEquipement1, e.numero_equipement].filter(Boolean).join(" — "),
      localisation: e.localisation,
    };
  });
}

/// Crée un devis avec son numéro attribué au moment de l'enregistrement :
/// si un autre devis a pris le même chrono entre-temps, la contrainte
/// d'unicité refuse l'insertion et on réessaie avec le numéro suivant.
export async function creerDevis(input: NouveauDevisInput): Promise<ActionResult & { numero?: string }> {
  const profil = await requireAdmin();
  if (!input.siteId) return { ok: false, erreur: "Choisis un site." };
  if (!input.libelle.trim()) return { ok: false, erreur: "Le libellé est obligatoire." };
  if (!NATURES_DEVIS_SELECTIONNABLES[input.nature]) return { ok: false, erreur: "Choisis une nature." };
  const lignesValides = input.lignes.filter((l) => l.designation.trim());
  if (lignesValides.length === 0) return { ok: false, erreur: "Ajoute au moins une ligne d'article." };

  // Toujours recalculé côté serveur depuis lignes + cout_revient — jamais
  // de montant envoyé tel quel par le client.
  const prixRevient = calculerPrixRevient(lignesValides, input.coutRevient);
  const montant = totalHTLignes(lignesValides, prixRevient.coefficientVente, prixRevient.tauxHoraire);

  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("n_affaire").eq("id", input.siteId).single();
  if (!site) return { ok: false, erreur: "Site introuvable." };
  const affaire = numeroAffaireDuSite(site.n_affaire);
  if (!affaire) {
    return { ok: false, erreur: "Ce site n'a pas de N° Affaire : impossible de numéroter le devis." };
  }

  const maintenant = new Date();
  const annee = String(maintenant.getFullYear()).slice(-2);
  const dateDevis = maintenant.toLocaleDateString("fr-FR");
  const initiales = initialesDe(profil.name);

  for (let essai = 0; essai < ESSAIS_NUMERO; essai++) {
    const { data: existants } = await supabase.from("devis").select("numero").like("numero", `D-${annee}-%`);
    const chrono = prochainChrono((existants ?? []).map((d) => d.numero), annee);
    const numero = formaterNumeroDevis({
      annee,
      chrono,
      initiales,
      client: affaire.client,
      site: affaire.site,
      nature: input.nature,
    });

    const donnees = {
      numero,
      item: String(chrono),
      site_id: input.siteId,
      libelle: input.libelle.trim(),
      nature: input.nature,
      montant,
      heures_prevues: prixRevient.heuresMO,
      debours_materiel_prevu: prixRevient.materiel,
      lignes: lignesValides,
      cout_revient: input.coutRevient,
      equipement_id: input.equipementId,
      localisation: input.localisation.trim(),
      date_devis: dateDevis,
      redacteur: profil.name,
      annule: false,
    };
    // Finalisation d'un brouillon ("Devis en cours") : on met à jour la
    // ligne existante plutôt que d'en créer une nouvelle, pour que le
    // numéro officiel lui soit attribué sans dupliquer le devis.
    const { error } = input.brouillonId
      ? await supabase.from("devis").update(donnees).eq("id", input.brouillonId)
      : await supabase.from("devis").insert(donnees);
    if (!error) {
      revalidatePath("/devis");
      revalidatePath("/devis/en-cours");
      return { ok: true, numero };
    }
    if (error.code !== ERREUR_DOUBLON) return { ok: false, erreur: error.message };
  }
  return { ok: false, erreur: "Impossible d'attribuer un numéro, réessaie." };
}

export type BrouillonDevisInput = {
  id?: string;
  siteId: string;
  libelle: string;
  nature: string;
  equipementId: string | null;
  localisation: string;
  lignes: LigneDevis[];
  coutRevient: CoutRevient;
};

/// Enregistre un devis incomplet ("Devis en cours") pour le reprendre
/// plus tard — contrairement à `creerDevis`, aucun numéro officiel
/// n'est attribué ici (voir `devis_numero_key`, qui autorise plusieurs
/// lignes à numéro vide) : seul site_id est exigé, tout le reste peut
/// manquer.
export async function enregistrerBrouillonDevis(input: BrouillonDevisInput): Promise<ActionResult & { id?: string }> {
  const profil = await requireAdmin();
  if (!input.siteId) return { ok: false, erreur: "Choisis un site avant d'enregistrer." };

  const lignesValides = input.lignes.filter((l) => l.designation.trim());
  const prixRevient = calculerPrixRevient(lignesValides, input.coutRevient);
  const montant = lignesValides.length > 0 ? totalHTLignes(lignesValides, prixRevient.coefficientVente, prixRevient.tauxHoraire) : null;

  const supabase = await createClient();
  const donnees = {
    site_id: input.siteId,
    libelle: input.libelle.trim(),
    nature: input.nature,
    montant,
    heures_prevues: prixRevient.heuresMO,
    debours_materiel_prevu: prixRevient.materiel,
    lignes: lignesValides,
    cout_revient: input.coutRevient,
    equipement_id: input.equipementId,
    localisation: input.localisation.trim(),
    date_devis: new Date().toLocaleDateString("fr-FR"),
    redacteur: profil.name,
    annule: false,
  };

  if (input.id) {
    const { error } = await supabase.from("devis").update(donnees).eq("id", input.id);
    if (error) return { ok: false, erreur: error.message };
    revalidatePath("/devis");
    revalidatePath("/devis/en-cours");
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase.from("devis").insert(donnees).select("id").single();
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/devis");
  revalidatePath("/devis/en-cours");
  return { ok: true, id: data.id };
}


export type DevisInput = {
  numero: string;
  item: string;
  redacteur: string;
  nature: string;
  date_devis: string;
  libelle: string;
  montant: number | null;
  date_commande_client: string;
  reference_client: string;
  statut_commande_fournisseur: string;
  date_mise_a_disposition_fourniture: string;
  bi_reference_historique: string;
  mois_facturation: string;
  remarques: string;
  debours_materiel_prevu: number | null;
  heures_prevues: number | null;
  email_responsable_contrat: string;
  annule: boolean;
  equipement_id?: string | null;
  localisation?: string;
};

/// Correction d'un devis existant (importé ou créé depuis l'appli).
export async function modifierDevis(id: string, input: DevisInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("devis")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/devis");
  revalidatePath("/prestations");
  return { ok: true };
}

const FORMAT_MOIS_ANNEE = /^\d{2}-\d{4}$/;

/// Mois de mise en facturation, format "MM-AAAA" imposé — séparé de
/// modifierDevis pour rester accessible depuis la fiche devis (pas de
/// gros formulaire modal à ouvrir juste pour ce champ).
export async function modifierMoisFacturation(id: string, moisFacturation: string): Promise<ActionResult> {
  await requireAdmin();
  if (moisFacturation && !FORMAT_MOIS_ANNEE.test(moisFacturation)) {
    return { ok: false, erreur: "Format attendu : MM-AAAA (ex : 10-2026)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("devis")
    .update({ mois_facturation: moisFacturation, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/devis/${id}/statut`);
  revalidatePath("/devis");
  return { ok: true };
}

export type StatutDevisInput = {
  date_commande_client: string;
  reference_client: string;
  annule: boolean;
};

/// Changement de statut ciblé (commandé / annulé / remis en attente),
/// sans passer par le formulaire complet modifierDevis — le badge de
/// statut sur Chrono Devis ouvre directement cette action.
export async function changerStatutDevis(id: string, input: StatutDevisInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("devis")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/devis");
  revalidatePath("/prestations");
  return { ok: true };
}

export async function lierEquipementDevis(id: string, equipementId: string | null): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("devis")
    .update({ equipement_id: equipementId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/devis");
  revalidatePath("/depannages");
  revalidatePath("/gmao", "layout");
  return { ok: true };
}

export async function supprimerDevis(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("devis").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/devis");
  revalidatePath("/prestations");
  return { ok: true };
}

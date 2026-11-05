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
import { calculerPrixRevient, totalHTLignes, type CoutRevient } from "@/lib/devis/pricing";
import { aplatirPaves, pavesDuDevis, type PaveDevis } from "@/lib/devis/paves";
import { genererPdfDevis } from "@/lib/devis/pdf";
import { envoyerDevis } from "@/lib/devis/email";

export type NouveauDevisInput = {
  siteId: string;
  /// Un pavé par équipement. La localisation reste un texte libre, utile
  /// notamment pour une Installation neuve (l'équipement n'existe pas encore).
  paves: PaveDevis[];
  coutRevient: CoutRevient;
  /// Brouillon existant ("Devis en cours") qu'on finalise — le numéro
  /// officiel lui est alors attribué par mise à jour, pas par insertion
  /// d'une nouvelle ligne.
  brouillonId?: string;
  /// Signalement "Devis à établir" à l'origine du devis (équipement en
  /// texte libre), voir @/lib/bi/devis-a-etablir.
  signalementBi?: string;
};

const ERREUR_DOUBLON = "23505";

function nettoyerPaves(paves: PaveDevis[]): PaveDevis[] {
  return paves.map((p) => ({
    ...p,
    localisation: p.localisation.trim(),
    libelle: p.libelle.trim(),
    lignes: p.lignes.filter((l) => l.designation.trim()),
  }));
}
const ESSAIS_NUMERO = 5;

export async function listerEquipementsDuSite(
  siteId: string,
): Promise<{ id: string; libelle: string; localisation: string; groupe: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, nom, numero_equipement, localisation, groupe")
    .eq("site_id", siteId)
    .order("nom");
  return (data ?? []).map((e) => {
    return {
      id: e.id,
      libelle: [e.nom, e.numero_equipement].filter(Boolean).join(" — "),
      localisation: e.localisation,
      groupe: e.groupe,
    };
  });
}

/// Crée un devis avec son numéro attribué au moment de l'enregistrement :
/// si un autre devis a pris le même chrono entre-temps, la contrainte
/// d'unicité refuse l'insertion et on réessaie avec le numéro suivant.
export async function creerDevis(input: NouveauDevisInput): Promise<ActionResult & { numero?: string }> {
  const profil = await requireAdmin();
  if (!input.siteId) return { ok: false, erreur: "Choisis un site." };
  const paves = nettoyerPaves(input.paves);
  if (paves.length === 0) return { ok: false, erreur: "Ajoute au moins un équipement." };
  for (const pave of paves) {
    if (!pave.libelle) return { ok: false, erreur: "Le libellé est obligatoire sur chaque pavé." };
    if (!NATURES_DEVIS_SELECTIONNABLES[pave.nature]) return { ok: false, erreur: "Choisis une nature sur chaque pavé." };
    if (pave.lignes.length === 0) return { ok: false, erreur: "Ajoute au moins une ligne d'article sur chaque pavé." };
  }
  const champsPaves = aplatirPaves(paves);
  const lignesValides = champsPaves.lignes;

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
      nature: champsPaves.nature,
    });

    const donnees = {
      numero,
      item: String(chrono),
      site_id: input.siteId,
      ...champsPaves,
      montant,
      heures_prevues: prixRevient.heuresMO,
      debours_materiel_prevu: prixRevient.materiel,
      cout_revient: input.coutRevient,
      date_devis: dateDevis,
      redacteur: profil.name,
      annule: false,
      ...(input.signalementBi ? { signalement_bi: input.signalementBi } : {}),
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
  paves: PaveDevis[];
  coutRevient: CoutRevient;
  signalementBi?: string;
};

/// Enregistre un devis incomplet ("Devis en cours") pour le reprendre
/// plus tard — contrairement à `creerDevis`, aucun numéro officiel
/// n'est attribué ici (voir `devis_numero_key`, qui autorise plusieurs
/// lignes à numéro vide) : seul site_id est exigé, tout le reste peut
/// manquer.
export async function enregistrerBrouillonDevis(input: BrouillonDevisInput): Promise<ActionResult & { id?: string }> {
  const profil = await requireAdmin();
  if (!input.siteId) return { ok: false, erreur: "Choisis un site avant d'enregistrer." };

  const champsPaves = aplatirPaves(nettoyerPaves(input.paves));
  const lignesValides = champsPaves.lignes;
  const prixRevient = calculerPrixRevient(lignesValides, input.coutRevient);
  const montant = lignesValides.length > 0 ? totalHTLignes(lignesValides, prixRevient.coefficientVente, prixRevient.tauxHoraire) : null;

  const supabase = await createClient();
  const donnees = {
    site_id: input.siteId,
    ...champsPaves,
    montant,
    heures_prevues: prixRevient.heuresMO,
    debours_materiel_prevu: prixRevient.materiel,
    cout_revient: input.coutRevient,
    date_devis: new Date().toLocaleDateString("fr-FR"),
    redacteur: profil.name,
    annule: false,
    ...(input.signalementBi ? { signalement_bi: input.signalementBi } : {}),
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
  equipements_supplementaires?: string[];
  localisation?: string;
};

/// Correction d'un devis existant (importé ou créé depuis l'appli).
export async function modifierDevis(id: string, input: DevisInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  // Le libellé et la nature vivent dans les pavés : un seul pavé suit la
  // modification, plusieurs pavés gardent les leurs (champs verrouillés
  // dans la fenêtre "Modifier").
  const { data: existant } = await supabase.from("devis").select("paves").eq("id", id).single();
  const paves = (existant?.paves as PaveDevis[] | null) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { libelle: _libelle, nature: _nature, ...sansLibelleNature } = input;
  const maj =
    paves.length > 1
      ? sansLibelleNature
      : paves.length === 1
        ? { ...input, paves: [{ ...paves[0], libelle: input.libelle, nature: input.nature }] }
        : input;

  const { error } = await supabase
    .from("devis")
    .update({ ...maj, updated_at: new Date().toISOString() })
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

/// Équipement de chaque pavé, dans l'ordre des pavés ("" = aucun).
export async function lierEquipementsPaves(id: string, equipementIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("*").eq("id", id).single();
  if (!devis) return { ok: false, erreur: "Devis introuvable." };

  const idsChoisis = equipementIds.filter(Boolean);
  const { data: equipements } =
    idsChoisis.length > 0
      ? await supabase.from("equipements").select("id, nom, numero_equipement").in("id", idsChoisis)
      : { data: [] };
  const paves = pavesDuDevis(devis).map((pave, i) => {
    const equipement = (equipements ?? []).find((e) => e.id === equipementIds[i]);
    return {
      ...pave,
      equipementId: equipement?.id ?? null,
      equipementNom: equipement ? [equipement.nom, equipement.numero_equipement].filter(Boolean).join(" — ") : "",
    };
  });

  const { error } = await supabase
    .from("devis")
    .update({ ...aplatirPaves(paves), updated_at: new Date().toISOString() })
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
  const { count } = await supabase
    .from("commandes_fournisseur")
    .select("id", { count: "exact", head: true })
    .eq("devis_id", id);
  if (count) {
    return { ok: false, erreur: "Suppression impossible : des commandes fournisseur sont liées à ce devis." };
  }

  const { error } = await supabase.from("devis").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/devis");
  revalidatePath("/prestations");
  return { ok: true };
}

export async function envoyerDevisParEmail(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: devis, error } = await supabase.from("devis").select("*").eq("id", id).single();
  if (error || !devis) return { ok: false, erreur: "Devis introuvable." };
  if (!devis.email_responsable_contrat) return { ok: false, erreur: "Aucun email connu pour ce client." };

  const { data: site } = await supabase.from("sites").select("nom, site").eq("id", devis.site_id).single();

  const pdfBytes = await genererPdfDevis({ devis, site: site ?? null });

  try {
    await envoyerDevis({ devis, site: site ?? null, destinataire: devis.email_responsable_contrat, pdfBytes });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi." };
  }

  await supabase.from("devis").update({ envoyee_le: new Date().toLocaleDateString("fr-FR") }).eq("id", id);
  revalidatePath(`/devis/${id}/statut`);
  return { ok: true };
}

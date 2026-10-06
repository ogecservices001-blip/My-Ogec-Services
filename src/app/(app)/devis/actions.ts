"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { NATURE_DEVIS } from "@/lib/devis/constants";
import {
  formaterNumeroDevis,
  initialesDe,
  numeroAffaireDuSite,
  prochainChrono,
} from "@/lib/devis/numerotation";

export type NouveauDevisInput = {
  siteId: string;
  libelle: string;
  nature: string;
  montant: number;
  heuresPrevues: number | null;
  equipementId: string | null;
};

const ERREUR_DOUBLON = "23505";
const ESSAIS_NUMERO = 5;

export async function listerEquipementsDuSite(siteId: string): Promise<{ id: string; libelle: string }[]> {
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
      libelle: [typeEquipement1, e.numero_equipement, e.localisation].filter(Boolean).join(" — "),
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
  if (!NATURE_DEVIS[input.nature]) return { ok: false, erreur: "Choisis une nature." };
  if (!Number.isFinite(input.montant) || input.montant < 0) return { ok: false, erreur: "Montant invalide." };

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
    const numero = formaterNumeroDevis({
      annee,
      chrono: prochainChrono((existants ?? []).map((d) => d.numero), annee),
      initiales,
      client: affaire.client,
      site: affaire.site,
      nature: input.nature,
    });

    const { error } = await supabase.from("devis").insert({
      numero,
      site_id: input.siteId,
      libelle: input.libelle.trim(),
      nature: input.nature,
      montant: input.montant,
      heures_prevues: input.heuresPrevues,
      equipement_id: input.equipementId,
      date_devis: dateDevis,
      redacteur: profil.name,
      annule: false,
    });
    if (!error) {
      revalidatePath("/devis");
      return { ok: true, numero };
    }
    if (error.code !== ERREUR_DOUBLON) return { ok: false, erreur: error.message };
  }
  return { ok: false, erreur: "Impossible d'attribuer un numéro, réessaie." };
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

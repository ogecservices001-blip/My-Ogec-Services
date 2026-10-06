"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

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

/// Pas de création manuelle depuis l'app — les devis arrivent
/// uniquement par import depuis "Suivi Devis" (même décision que pour
/// l'ancienne table affaires). Seule la correction d'un devis déjà
/// importé est permise ici.
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

export type AffaireInput = {
  numero_devis: string;
  designation_prestations: string;
  email_responsable_contrat: string;
  date_commande_client: string;
  numero_commande_client: string;
  nature: string;
};

/// Pas de création manuelle depuis l'app — les affaires arrivent
/// uniquement par import (décision explicite de l'utilisateur, voir
/// AffaireImportService côté Flutter). Seule la correction d'une
/// affaire déjà importée est permise ici.
export async function modifierAffaire(id: string, input: AffaireInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("affaires")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/affaires");
  return { ok: true };
}

export async function supprimerAffaire(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("affaires").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/affaires");
  return { ok: true };
}

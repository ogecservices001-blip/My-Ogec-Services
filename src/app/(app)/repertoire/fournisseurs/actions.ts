"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fournisseurSchema, type FournisseurInput } from "@/lib/validation/fournisseur";
import type { ActionResult } from "@/lib/action-result";

export async function creerFournisseur(input: FournisseurInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = fournisseurSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("fournisseurs").insert(parsed.data);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true };
}

export async function modifierFournisseur(id: string, input: FournisseurInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = fournisseurSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("fournisseurs").update(parsed.data).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  revalidatePath(`/repertoire/fournisseurs/${id}`);
  return { ok: true };
}

/// Mémorise dans la fiche fournisseur des conditions de paiement
/// découvertes sur un devis scanné (commande fournisseur) — seulement
/// si la fiche n'en a pas déjà, pour ne plus avoir à les relire ensuite.
/// N'écrase jamais une valeur déjà saisie.
export async function enregistrerConditionsPaiementFournisseur(id: string, delaiPaiement: string): Promise<ActionResult> {
  await requireAdmin();
  if (!delaiPaiement.trim()) return { ok: true };

  const supabase = await createClient();
  const { data: fournisseur } = await supabase.from("fournisseurs").select("delai_paiement").eq("id", id).single();
  if (!fournisseur || fournisseur.delai_paiement) return { ok: true };

  const { error } = await supabase.from("fournisseurs").update({ delai_paiement: delaiPaiement.trim() }).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  revalidatePath(`/repertoire/fournisseurs/${id}`);
  return { ok: true };
}

export async function supprimerFournisseur(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("fournisseurs").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true };
}

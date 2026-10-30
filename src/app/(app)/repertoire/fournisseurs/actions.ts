"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fournisseurSchema, type FournisseurInput } from "@/lib/validation/fournisseur";
import type { ActionResult } from "@/lib/action-result";
import { extraireFournisseurDepuisDevis, type FournisseurExtraitResultat } from "@/lib/repertoire/fournisseur-ocr";

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

/// Complète la fiche fournisseur avec ce qu'on apprend en lisant un
/// devis scanné (commande fournisseur) — uniquement les champs encore
/// vides, jamais une valeur déjà saisie à la main. "Par virement" est
/// le mode de règlement par défaut de tous les fournisseurs (jamais lu
/// sur le devis) ; "CGV reçues" passe à "Oui" dès qu'un devis arrive,
/// les CGV étant toujours transmises avec (règle métier, pas une
/// lecture du document).
export async function completerFicheFournisseurDepuisDevis(
  id: string,
  decouvertes: { delaiPaiement?: string; produitsCles?: string },
): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: fournisseur } = await supabase
    .from("fournisseurs")
    .select("delai_paiement, mode_reglement, cgv_recues, produits_cles")
    .eq("id", id)
    .single();
  if (!fournisseur) return { ok: true };

  const maj: Record<string, string> = {};
  if (!fournisseur.delai_paiement && decouvertes.delaiPaiement?.trim()) {
    maj.delai_paiement = decouvertes.delaiPaiement.trim();
  }
  if (!fournisseur.produits_cles && decouvertes.produitsCles?.trim()) {
    maj.produits_cles = decouvertes.produitsCles.trim();
  }
  if (!fournisseur.mode_reglement) maj.mode_reglement = "Par virement";
  if (!fournisseur.cgv_recues) maj.cgv_recues = "Oui";

  if (Object.keys(maj).length === 0) return { ok: true };

  const { error } = await supabase.from("fournisseurs").update(maj).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  revalidatePath(`/repertoire/fournisseurs/${id}`);
  return { ok: true };
}

/// Lit le devis/facture fournisseur envoyé (PDF/photo) et renvoie les
/// informations détectées pour pré-remplir le formulaire "Nouveau
/// fournisseur" — à relire par le bureau, jamais enregistré directement.
export async function analyserFournisseurDepuisDevis(
  formData: FormData,
): Promise<{ ok: true; resultat: FournisseurExtraitResultat } | { ok: false; erreur: string }> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }
  const typesAcceptes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!typesAcceptes.includes(fichier.type)) {
    return { ok: false, erreur: "Fichier non pris en charge — envoie un PDF ou une photo (PNG/JPEG)." };
  }

  try {
    const bytes = Buffer.from(await fichier.arrayBuffer());
    const resultat = await extraireFournisseurDepuisDevis({ bytes, mimeType: fichier.type });
    if (!resultat.nom) return { ok: false, erreur: "Impossible d'identifier le fournisseur sur ce document." };
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de la lecture automatique." };
  }
}

export async function supprimerFournisseur(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("fournisseurs").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true };
}

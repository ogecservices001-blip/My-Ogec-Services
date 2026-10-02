"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { profilSchema } from "@/lib/validation/profil";
import { QUALITE_VERS_ROLE } from "@/lib/repertoire/qualites";
import type { ActionResult } from "@/lib/action-result";

function lireFormulaire(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [cle, valeur] of formData.entries()) {
    if (typeof valeur === "string") obj[cle] = valeur;
  }
  return obj;
}

/// Modifie un collaborateur. Le rôle (niveau d'accès) n'est jamais
/// saisi directement : il se déduit de la qualité choisie, selon la
/// grille définie par le bureau (QUALITE_VERS_ROLE). Tant qu'aucun
/// compte Supabase Auth n'existe pour cette personne, ce rôle reste
/// sans effet (pas de connexion possible) — il est simplement déjà
/// posé pour le jour où le compte sera créé.
export async function modifierProfil(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const brut = lireFormulaire(formData);
  const parsed = profilSchema.safeParse(brut);
  if (!parsed.success) {
    const champs: Record<string, string> = {};
    for (const issue of parsed.error.issues) champs[String(issue.path[0])] = issue.message;
    return { ok: false, erreur: "Formulaire invalide.", champs };
  }

  const donnees: Record<string, unknown> = { ...parsed.data };
  const role = QUALITE_VERS_ROLE[parsed.data.qualite];
  if (role) donnees.role = role;

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(donnees).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/collaborateurs");
  return { ok: true };
}

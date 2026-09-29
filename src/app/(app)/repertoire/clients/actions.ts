"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { siteSchema } from "@/lib/validation/site";
import type { ActionResult } from "@/lib/action-result";

function lireFormulaire(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [cle, valeur] of formData.entries()) {
    if (typeof valeur === "string") obj[cle] = valeur;
  }
  return obj;
}

/// Crée un nouveau site. Admin uniquement (RLS + requireAdmin, double
/// vérification). Signature (prevState, formData) pour useActionState.
export async function creerSite(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = siteSchema.safeParse(lireFormulaire(formData));
  if (!parsed.success) {
    const champs: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      champs[String(issue.path[0])] = issue.message;
    }
    return { ok: false, erreur: "Formulaire invalide.", champs };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert(parsed.data);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/clients");
  return { ok: true };
}

/// Modifie un site existant. À lier avec `.bind(null, site.id)` avant
/// de passer à useActionState (donne bien la signature attendue :
/// (prevState, formData)).
export async function modifierSite(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = siteSchema.safeParse(lireFormulaire(formData));
  if (!parsed.success) {
    const champs: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      champs[String(issue.path[0])] = issue.message;
    }
    return { ok: false, erreur: "Formulaire invalide.", champs };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sites").update(parsed.data).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/clients");
  revalidatePath(`/repertoire/clients/${id}`);
  return { ok: true };
}

/// Supprime un site.
export async function supprimerSite(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/clients");
  return { ok: true };
}

/// Supprime tous les sites d'un même client (regroupement par `nom`) —
/// équivalent de la suppression groupée côté Flutter.
export async function supprimerSitesDuClient(nom: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("nom", nom);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/repertoire/clients");
  return { ok: true };
}

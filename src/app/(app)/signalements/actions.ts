"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import type { TypeSignalement } from "@/lib/types";

/// N'importe quel collaborateur connecté peut envoyer un signalement —
/// seul le bureau (admin) peut ensuite le consulter/traiter (RLS sur
/// "signalements").
export async function envoyerSignalement(
  type: TypeSignalement,
  message: string,
): Promise<ActionResult> {
  const profile = await requireProfile();

  const texte = message.trim();
  if (!texte) return { ok: false, erreur: "Le message est vide." };

  const supabase = await createClient();
  const { error } = await supabase.from("signalements").insert({
    auteur_id: profile.id,
    auteur_nom: profile.name,
    type,
    message: texte,
  });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/signalements");
  return { ok: true };
}

export async function marquerSignalement(id: string, traite: boolean): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("signalements").update({ traite }).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/signalements");
  return { ok: true };
}

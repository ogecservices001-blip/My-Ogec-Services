"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireAdmin } from "@/lib/auth";
import { prochainChrono } from "@/lib/gmao/chrono";
import { initiales } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { TypeSignalement } from "@/lib/types";

export type SaisieSignalement = {
  type: TypeSignalement;
  menu: string;
  sousMenu: string;
  nature: string;
  detail: string;
};

/// N'importe quel collaborateur connecté peut envoyer un signalement —
/// seul le bureau (admin) peut ensuite le consulter/traiter (RLS sur
/// "signalements"). Saisie guidée (menu > sous-menu > nature), pas de
/// texte libre obligatoire — le détail reste facultatif.
export async function envoyerSignalement(saisie: SaisieSignalement): Promise<ActionResult> {
  const profile = await requireProfile();

  if (!saisie.menu || !saisie.sousMenu || !saisie.nature) {
    return { ok: false, erreur: "Merci de compléter les 3 choix (menu, sous-menu, nature)." };
  }

  const supabase = await createClient();
  const annee = new Date().getFullYear();
  const chrono = await prochainChrono(supabase, "SIG", annee);
  const numero = `SIG-${chrono}-${initiales(profile.name)}`;

  const { data, error } = await supabase
    .from("signalements")
    .insert({
      numero,
      auteur_id: profile.id,
      auteur_nom: profile.name,
      type: saisie.type,
      menu: saisie.menu,
      sous_menu: saisie.sousMenu,
      nature: saisie.nature,
      message: saisie.detail.trim(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, erreur: error.message };

  await supabase.from("signalements_historique").insert({
    signalement_id: data.id,
    auteur_nom: profile.name,
    action: "Création du signalement",
  });

  revalidatePath("/signalements");
  return { ok: true };
}

export async function marquerSignalement(id: string, traite: boolean): Promise<ActionResult> {
  const profile = await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("signalements").update({ traite }).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  await supabase.from("signalements_historique").insert({
    signalement_id: id,
    auteur_nom: profile.name,
    action: traite ? "Marqué traité" : "Rouvert",
  });

  revalidatePath("/signalements");
  return { ok: true };
}

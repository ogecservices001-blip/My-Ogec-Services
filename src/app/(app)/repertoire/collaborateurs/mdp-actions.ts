"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

/// Va chercher le mot de passe applicatif d'un collaborateur, à la
/// demande — jamais inclus dans le chargement de la liste (il ne doit
/// jamais atterrir dans une page vue par un non-admin). Pense-bête
/// uniquement : ne reflète pas forcément le mot de passe réellement
/// actif sur le compte Supabase Auth.
export async function recupererMotDePasse(
  profilId: string,
): Promise<{ ok: true; mdp: string } | { ok: false; erreur: string }> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profils_mdp")
    .select("mdp_app")
    .eq("profil_id", profilId)
    .maybeSingle();
  if (error) return { ok: false, erreur: error.message };

  return { ok: true, mdp: data?.mdp_app ?? "" };
}

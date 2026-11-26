"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { URL_APPLI } from "@/lib/planning/validation";
import { envoyerLienReinitialisation, signalerDemandeMotDePasse } from "@/lib/email-mot-de-passe";

/// « Mot de passe oublié » (techniciens seulement). La réponse est toujours
/// la même, que le compte existe ou non, pour ne rien révéler. Client
/// admin : le visiteur n'est pas connecté.
export async function demanderReinitialisation(email: string): Promise<{ ok: true }> {
  const adresse = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) return { ok: true };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: adresse });
    const jeton = data?.properties?.hashed_token;
    if (error || !data?.user || !jeton) return { ok: true };
    const { data: profil } = await admin.from("profiles").select("name, role").eq("id", data.user.id).maybeSingle();
    if (!profil || profil.role !== "technicien") return { ok: true };
    const lien = `${URL_APPLI}/login/nouveau-mot-de-passe?token_hash=${encodeURIComponent(jeton)}&type=recovery`;
    await envoyerLienReinitialisation({ destinataire: adresse, nom: profil.name, lien });
    await signalerDemandeMotDePasse(profil.name, new Date());
  } catch (e) {
    console.error("Mot de passe oublié : envoi impossible", e);
  }
  return { ok: true };
}

/// Nouveau mot de passe choisi depuis le lien reçu par mail : appliqué au
/// compte et noté dans le pense-bête du bureau (Répertoire collaborateurs).
export async function changerMotDePasse(motDePasse: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (motDePasse.length < 6) return { ok: false, erreur: "Le mot de passe doit faire au moins 6 caractères." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erreur: "Lien expiré : refais une demande de mot de passe oublié." };
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) {
    return {
      ok: false,
      erreur: /different|same/i.test(error.message) ? "Choisis un mot de passe différent de l'ancien." : error.message,
    };
  }
  await createAdminClient()
    .from("profils_mdp")
    .upsert({ profil_id: user.id, mdp_app: motDePasse, updated_at: new Date().toISOString() }, { onConflict: "profil_id" });
  return { ok: true };
}

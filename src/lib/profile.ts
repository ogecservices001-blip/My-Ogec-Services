import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export type Profile = {
  id: string;
  role: Role;
  name: string;
};

/// Profil (rôle + nom) de l'utilisateur connecté, pour cette requête —
/// équivalent de UserService().isCurrentUserAdmin() côté Flutter.
/// `null` si non connecté (le middleware redirige déjà vers /login dans
/// ce cas, donc ça ne devrait arriver que pour un compte sans fiche
/// `profiles` encore créée).
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, role, name")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

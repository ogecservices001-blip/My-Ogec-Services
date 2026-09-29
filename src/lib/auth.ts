import { redirect, forbidden } from "next/navigation";
import { getCurrentProfile, type Profile } from "@/lib/profile";

/// À appeler en tête d'un Server Component ou d'une Server Action qui a
/// besoin d'un utilisateur connecté, quel que soit son rôle. Redirige
/// vers /login sinon (filet de sécurité : le middleware le fait déjà
/// au niveau des routes, ceci protège aussi les Server Actions,
/// jamais interceptées par le middleware de page).
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/// Même chose, mais exige en plus le rôle admin — utilisé par toute
/// mutation ou tout écran réservé au bureau (Répertoire en écriture,
/// gestion des comptes...). 403 si le rôle est insuffisant, jamais un
/// simple masquage côté UI.
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") forbidden();
  return profile;
}

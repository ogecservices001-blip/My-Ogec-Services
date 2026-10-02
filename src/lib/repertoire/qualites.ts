import type { Database } from "@/lib/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

/// Grille d'accès définie par le bureau : la qualité détermine le
/// niveau d'accès attribué quand un compte est créé pour la personne.
/// Un changement de qualité ne crée jamais de compte tout seul — tant
/// qu'aucun compte Supabase Auth n'existe, le rôle reste sans effet
/// (pas de connexion possible), mais on le garde synchronisé avec la
/// qualité pour que la création du compte, le moment venu, n'ait plus
/// qu'à reprendre ce rôle déjà posé.
export const QUALITES = [
  "Assistant Technicien",
  "Technicien",
  "Monteur",
  "Responsable Administratif",
  "Responsable Administrative",
  "Gérant",
  "Développeur",
] as const;

export const QUALITE_VERS_ROLE: Record<string, UserRole> = {
  "Assistant Technicien": "en_attente",
  Technicien: "technicien",
  Monteur: "technicien",
  "Responsable Administratif": "admin",
  "Responsable Administrative": "admin",
  Gérant: "admin",
  Développeur: "admin",
};

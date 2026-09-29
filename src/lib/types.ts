import type { Database } from "./database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/// La vue `sites_view` ajoute `hors_contrat` (calculé) par-dessus la
/// table `sites` — mais Postgres marque toutes les colonnes d'une vue
/// comme nullables dans les types générés, même quand la table sous-
/// jacente ne l'est pas. On garde donc le type de la table (colonnes
/// non-nullables, fidèle au schéma réel) et on ajoute juste le champ
/// calculé à la main plutôt que de repartir de la vue générée.
export type Site = Tables<"sites"> & { hors_contrat: boolean };

export type Fournisseur = Tables<"fournisseurs">;

export type Profil = Tables<"profiles">;

export type Role = Enums<"user_role">;

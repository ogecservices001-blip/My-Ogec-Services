import type { ProfilInput } from "@/lib/validation/profil";

/// Position (colonne, 0-based) de chaque champ dans la feuille
/// "COLLABORATEURS" — même ordre à l'export et à l'import.
export const COLONNES_PROFILS: { index: number; champ: keyof ProfilInput }[] = [
  { index: 0, champ: "name" },
  { index: 1, champ: "qualite" },
  { index: 2, champ: "portable" },
  { index: 3, champ: "email_perso" },
  { index: 4, champ: "commune_habitation" },
  { index: 5, champ: "vehicule" },
];

export const ENTETES_PROFILS: Record<number, string> = {
  0: "Nom",
  1: "Qualité",
  2: "Portable",
  3: "Email personnel",
  4: "Commune",
  5: "Véhicule",
};

export const NB_COLONNES_PROFILS = 6;

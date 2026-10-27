import type { ProfilInput } from "@/lib/validation/profil";
import { telInternational, telLocal } from "@/lib/format";

/// Position (colonne, 0-based) de chaque champ dans la feuille
/// "COLLABORATEURS" — même ordre à l'export et à l'import.
export const COLONNES_PROFILS: { index: number; champ: keyof ProfilInput }[] = [
  { index: 0, champ: "name" },
  { index: 1, champ: "qualite" },
  { index: 2, champ: "portable" },
  { index: 3, champ: "email_pro" },
  { index: 4, champ: "email_perso" },
  { index: 5, champ: "commune_habitation" },
  { index: 6, champ: "vehicule" },
];

export const ENTETES_PROFILS: Record<number, string> = {
  0: "Nom",
  1: "Qualité",
  2: "Portable",
  3: "Email pro",
  4: "Email personnel",
  5: "Commune",
  6: "Véhicule",
  7: "Mdp My Ogec",
  8: "Email récupération",
};

export const NB_COLONNES_PROFILS = 9;

/// Construit une ligne complète de la feuille "COLLABORATEURS" — numéro
/// de portable au format international (+262).
export function ligneProfil(profil: Record<string, unknown>): string[] {
  const ligne: string[] = new Array(NB_COLONNES_PROFILS).fill("");
  for (const { index, champ } of COLONNES_PROFILS) {
    const valeur = String(profil[champ] ?? "");
    ligne[index] = champ === "portable" ? telInternational(valeur) : valeur;
  }
  return ligne;
}

/// Inverse de ligneProfil, pour que le fichier exporté reste
/// réimportable tel quel.
export function normaliserValeurImportProfil(champ: keyof ProfilInput, valeur: string): string {
  return champ === "portable" ? telLocal(valeur) : valeur;
}

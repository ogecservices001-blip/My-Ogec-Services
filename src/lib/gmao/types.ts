import { z } from "zod";
import type { Tables } from "@/lib/types";

/// Champ d'en-tête spécifique à une famille, en plus du tronc commun
/// partagé par toutes les fiches (client, site, marque, référence,
/// n° série, tension, puissance, mise en service...). Fidèle à
/// `ChampEnTete` (type_equipement_model.dart).
export const champEnTeteSchema = z.object({
  cle: z.string(),
  label: z.string(),
  options: z.array(z.string()).default([]),
  numerique: z.boolean().default(false),
  unite: z.string().default(""),
  /// true : ce champ partage sa ligne d'affichage avec le suivant.
  memeLigneSuivant: z.boolean().default(false),
});
export type ChampEnTete = z.infer<typeof champEnTeteSchema>;

/// Sous-champ d'une ligne de `ChampListe` (ex: "Taille", "Nombre").
export const sousChampSchema = z.object({
  cle: z.string(),
  label: z.string(),
  unite: z.string().default(""),
});
export type SousChamp = z.infer<typeof sousChampSchema>;

/// Champ d'en-tête "à rallonge" : une liste de lignes ajoutables/
/// supprimables librement, chaque ligne portant les mêmes sous-champs
/// (ex: "Filtres" — Référence/Type/Taille/Nombre).
export const champListeSchema = z.object({
  cle: z.string(),
  label: z.string(),
  sousChamps: z.array(sousChampSchema).default([]),
});
export type ChampListe = z.infer<typeof champListeSchema>;

export const typeValeurChecklistSchema = z.enum(["bool", "enum", "text"]);
export type TypeValeurChecklist = z.infer<typeof typeValeurChecklistSchema>;

/// Une opération de la checklist d'entretien, avec son type de valeur
/// attendue : case à cocher (bool), choix parmi une liste (enum, avec
/// ses propres options), ou texte libre.
export const checklistItemSchema = z.object({
  rep: z.number().int(),
  label: z.string(),
  typeValeur: typeValeurChecklistSchema.default("bool"),
  options: z.array(z.string()).default([]),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

/// Un champ mesuré au sein d'un groupe de mesures (ex: "Intensité
/// mesurée Ph.1", unité "A").
export const champMesureSchema = z.object({
  cle: z.string(),
  label: z.string(),
  unite: z.string().default(""),
});
export type ChampMesure = z.infer<typeof champMesureSchema>;

/// Un groupe de mesures techniques (ex: "Compresseur"). Un groupe
/// répétable se répète jusqu'à `nombreMax` fois sur la fiche.
export const groupeMesureSchema = z.object({
  cle: z.string(),
  label: z.string(),
  repetable: z.boolean().default(false),
  nombreMax: z.number().int().default(1),
  champs: z.array(champMesureSchema).default([]),
});
export type GroupeMesure = z.infer<typeof groupeMesureSchema>;

/// Ligne `types_equipement` Postgres, avec les colonnes jsonb affinées
/// (la ligne brute générée par Supabase les type en `Json`).
export type TypeEquipement = Omit<
  Tables<"types_equipement">,
  "champs_en_tete_supplementaires" | "champs_listes" | "checklist" | "groupes_mesures"
> & {
  champs_en_tete_supplementaires: ChampEnTete[];
  champs_listes: ChampListe[];
  checklist: ChecklistItem[];
  groupes_mesures: GroupeMesure[];
};

export type ReferenceHoraire = Tables<"references_horaires">;

/// Une ligne d'un `ChampListe` déjà saisie sur une fiche équipement
/// (clé = `SousChamp.cle`, valeur = texte saisi).
export type ChampListeLigne = Record<string, string>;

/// Valeurs des champs d'en-tête spécifiques d'un équipement (clé =
/// `ChampEnTete.cle` ou `ChampListe.cle`) — texte pour un `ChampEnTete`,
/// liste de lignes pour un `ChampListe`. Fidèle à `equipements.champsEnTete`
/// (equipement_model.dart), schéma polymorphe piloté par la famille.
export type ChampsEnTeteEquipement = Record<string, string | ChampListeLigne[]>;

export type Equipement = Omit<Tables<"equipements">, "champs_en_tete"> & {
  champs_en_tete: ChampsEnTeteEquipement;
};

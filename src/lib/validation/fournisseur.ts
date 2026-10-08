import { z } from "zod";

const optionnel = () => z.string().trim().default("");

export const interlocuteurSchema = z.object({
  nom: z.string().trim().default(""),
  tel: z.string().trim().default(""),
  portable: z.string().trim().default(""),
  email: z.string().trim().default(""),
});

export type Interlocuteur = z.infer<typeof interlocuteurSchema>;

export const fournisseurSchema = z.object({
  nom: z.string().trim().min(1, "Le nom du fournisseur est obligatoire"),
  denomination_courte: optionnel(),
  nature_fourniture: optionnel(),
  interlocuteurs: z.array(interlocuteurSchema).default([]),
  site_web: optionnel(),
  commune: optionnel(),
  code_postal: optionnel(),
  adresse: optionnel(),
  complement_adresse: optionnel(),
  localisation: optionnel(),
  produits_cles: optionnel(),
  remarques: optionnel(),
  raison_sociale_exacte: optionnel(),
  forme_juridique: optionnel(),
  siren: optionnel(),
  siret: optionnel(),
  tva_intracom: optionnel(),
  rcs_rm: optionnel(),
  delai_paiement: optionnel(),
  mode_reglement: optionnel(),
  cgv_recues: optionnel(),
  fiche_maj_le: optionnel(),
});

export type FournisseurInput = z.infer<typeof fournisseurSchema>;

/// Champs visibles par les techniciens sur le terrain (anciennement les
/// colonnes orange du classeur "Base Fournisseurs") — le strict
/// nécessaire pour contacter un fournisseur. Le reste (infos
/// juridiques/administratives) est admin uniquement.
export const CHAMPS_VISIBLES_TECHNICIEN: (keyof FournisseurInput)[] = [
  "nom",
  "nature_fourniture",
  "adresse",
  "complement_adresse",
  "code_postal",
  "commune",
  "interlocuteurs",
];

export const champsFournisseur: { cle: keyof FournisseurInput; label: string }[] = [
  { cle: "nom", label: "Nom" },
  { cle: "denomination_courte", label: "Dénomination courte" },
  { cle: "nature_fourniture", label: "Nature fourniture" },
  { cle: "commune", label: "Ville" },
  { cle: "code_postal", label: "Code postal" },
  { cle: "adresse", label: "Adresse" },
  { cle: "complement_adresse", label: "Complément d'adresse" },
  { cle: "localisation", label: "Localisation" },
  { cle: "site_web", label: "Site web" },
  { cle: "produits_cles", label: "Produits clés" },
  { cle: "remarques", label: "Remarques" },
  { cle: "raison_sociale_exacte", label: "Raison sociale exacte" },
  { cle: "forme_juridique", label: "Forme juridique" },
  { cle: "siren", label: "SIREN" },
  { cle: "siret", label: "SIRET" },
  { cle: "tva_intracom", label: "N° TVA intracom." },
  { cle: "rcs_rm", label: "RCS / RM" },
  { cle: "delai_paiement", label: "Délai de paiement" },
  { cle: "mode_reglement", label: "Mode de règlement" },
  { cle: "cgv_recues", label: "CGV reçues" },
  { cle: "fiche_maj_le", label: "Fiche mise à jour le" },
];

/// "Réunion" → TVA DOM, "Métropole" → export DOM — même règle que le
/// classeur legacy (colonne "TVA sur facture", calculée, pas saisie).
export function tvaSurFacture(localisation: string): string {
  if (localisation === "Réunion") return "8,5 % (TVA DOM)";
  if (localisation === "Métropole") return "HT - export DOM";
  return "";
}

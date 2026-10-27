import type { SiteInput } from "@/lib/validation/site";
import { formaterDate } from "@/lib/format";
import { eur } from "@/lib/commandes-fournisseur/format";

/// Position (colonne, 0-based) de chaque champ dans la feuille "SITES"
/// du classeur maître — même mapping que
/// DatabaseService.importClientsFromExcelRows / RepertoireExportService
/// côté Flutter, pour rester réimportable avec le même fichier. Les
/// index absents (0, 3, 4) sont des colonnes du fichier maître non
/// reprises dans le modèle.
export const COLONNES_SITES: { index: number; champ: keyof SiteInput }[] = [
  { index: 1, champ: "nom" },
  { index: 2, champ: "site" },
  { index: 5, champ: "n_affaire" },
  { index: 6, champ: "nb_heures_vendues" },
  { index: 7, champ: "nb_heures_vendues_assistant" },
  { index: 8, champ: "qte_heures_programmees" },
  { index: 9, champ: "qte_heures_restantes" },
  { index: 10, champ: "freq_entretien_an" },
  { index: 11, champ: "commune" },
  { index: 12, champ: "code_postal" },
  { index: 13, champ: "adresse" },
  { index: 14, champ: "complement_adresse" },
  { index: 15, champ: "interlocuteur_site" },
  { index: 16, champ: "tel_fixe_interlocuteur_site" },
  { index: 17, champ: "portable_interlocuteur_site" },
  { index: 18, champ: "courriel_interlocuteur_site" },
  { index: 19, champ: "responsable_contrat" },
  { index: 20, champ: "tel_fixe_responsable" },
  { index: 21, champ: "portable_responsable" },
  { index: 22, champ: "courriel_responsable" },
  { index: 23, champ: "commune_facturation" },
  { index: 24, champ: "code_postal_facturation" },
  { index: 25, champ: "adresse_facturation" },
  { index: 26, champ: "complement_adresse_facturation" },
  { index: 27, champ: "interlocuteur_facturation" },
  { index: 28, champ: "tel_fixe_interlocuteur_facturation" },
  { index: 29, champ: "portable_interlocuteur_facturation" },
  { index: 30, champ: "courriel_interlocuteur_facturation" },
  { index: 31, champ: "interlocuteur_tiers" },
  { index: 32, champ: "tel_fixe_tiers" },
  { index: 33, champ: "portable_tiers" },
  { index: 34, champ: "courriel_tiers" },
  { index: 35, champ: "epi_specifique" },
  { index: 36, champ: "habilitation_specifique" },
  { index: 37, champ: "moyen_acces" },
  { index: 38, champ: "jour_acces" },
  { index: 39, champ: "heures_acces" },
  { index: 40, champ: "date_offre" },
  { index: 41, champ: "date_prise_effet_contrat" },
  { index: 42, champ: "duree_contrat" },
  { index: 43, champ: "montant_contrat_av" },
  { index: 44, champ: "date_fin_contrat" },
  { index: 45, champ: "date_indice_s_prime" },
  { index: 46, champ: "date_indice_ch_prime" },
  { index: 47, champ: "taux_horaire_vendu" },
  { index: 48, champ: "taux_horaire_regie" },
  { index: 49, champ: "forfait_deplacement" },
  { index: 50, champ: "reference_offre_ogs" },
  { index: 51, champ: "valeur_indice_s_prime" },
  { index: 52, champ: "valeur_indice_ch_prime" },
  { index: 53, champ: "freq_factu_annuelle" },
  { index: 54, champ: "delai_intervention" },
  { index: 55, champ: "formule_revision_entretien" },
  { index: 56, champ: "formule_revision_depannage" },
  { index: 57, champ: "date_revision" },
  { index: 58, champ: "date_indice_s" },
  { index: 59, champ: "valeur_indice_s" },
  { index: 60, champ: "date_indice_ch" },
  { index: 61, champ: "valeur_indice_ch" },
  { index: 62, champ: "montant_contrat_av_revise" },
  { index: 63, champ: "taux_horaire_revise" },
  { index: 64, champ: "forfait_deplacement_revise" },
  { index: 65, champ: "modif_ri_ou_bg" },
  { index: 66, champ: "remarques_libres" },
];

export const ENTETES_SITES: Record<number, string> = {
  0: "ITEM",
  1: "Nom",
  3: "N° Client",
  4: "N° Site",
  2: "Site",
  5: "N° Affaire",
  6: "Nb Heures Vendues",
  7: "Nb Heures Vendues Assistant",
  8: "Qté Heures Programmées",
  9: "Qté Heures Restantes",
  10: "Fréq. Entretien/an",
  11: "Commune",
  12: "Code Postal",
  13: "Adresse",
  14: "Complément Adresse",
  15: "Interlocuteur Site",
  16: "Tél Fixe Interlocuteur Site",
  17: "Portable Interlocuteur Site",
  18: "Courriel Interlocuteur Site",
  19: "Responsable Contrat",
  20: "Tél Fixe Responsable",
  21: "Portable Responsable",
  22: "Courriel Responsable",
  23: "Commune Facturation",
  24: "Code Postal Facturation",
  25: "Adresse Facturation",
  26: "Complément Adresse Facturation",
  27: "Interlocuteur Facturation",
  28: "Tél Fixe Interlocuteur Facturation",
  29: "Portable Interlocuteur Facturation",
  30: "Courriel Interlocuteur Facturation",
  31: "Interlocuteur Tiers",
  32: "Tél Fixe Tiers",
  33: "Portable Tiers",
  34: "Courriel Tiers",
  35: "EPI Spécifique",
  36: "Habilitation Spécifique",
  37: "Moyen Accès",
  38: "Jour Accès",
  39: "Heures Accès",
  40: "Date Offre",
  41: "Date Prise Effet Contrat",
  42: "Durée Contrat",
  43: "Montant Contrat AV",
  44: "Date Fin Contrat",
  45: "Date Indice S'",
  46: "Date Indice Ch'",
  47: "Taux Horaire Vendu",
  48: "Taux Horaire Régie",
  49: "Forfait Déplacement",
  50: "Référence Offre OGS",
  51: "Valeur Indice S'",
  52: "Valeur Indice Ch'",
  53: "Fréq. Factu. Annuelle",
  54: "Délai Intervention",
  55: "Formule Révision Entretien",
  56: "Formule Révision Dépannage",
  57: "Date Révision",
  58: "Date Indice S",
  59: "Valeur Indice S",
  60: "Date Indice Ch",
  61: "Valeur Indice Ch",
  62: "Montant Contrat AV Révisé",
  63: "Taux Horaire Révisé",
  64: "Forfait Déplacement Révisé",
  65: "Modif RI ou BG",
  66: "Remarques Libres",
};

export const NB_COLONNES_SITES = 67;

/// Numéro Client / Numéro Site tels qu'affichés dans le fichier maître
/// (ex: "265-01" → "265" / "01") — dérivés de n_affaire, jamais stockés
/// séparément en base.
function numeroClientEtSite(nAffaire: string): [string, string] {
  const [numClient, numSite] = (nAffaire ?? "").split("-");
  return [numClient ?? "", numSite ?? ""];
}

/// "0692 91 02 26" → "+262 692 91 02 26" — ne touche pas aux valeurs qui
/// ne ressemblent pas à un numéro local à 10 chiffres (vide, "Inconnu",
/// déjà international...).
function formaterTelInternational(numero: string): string {
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length !== 10 || !chiffres.startsWith("0")) return numero;
  const groupes = chiffres.slice(1).match(/.{2}/g) ?? [];
  return `+262 ${groupes.join(" ")}`;
}

const CHAMPS_TELEPHONE = new Set<keyof SiteInput>([
  "tel_fixe_interlocuteur_site",
  "portable_interlocuteur_site",
  "tel_fixe_responsable",
  "portable_responsable",
  "tel_fixe_interlocuteur_facturation",
  "portable_interlocuteur_facturation",
  "tel_fixe_tiers",
  "portable_tiers",
]);

const CHAMPS_DATE = new Set<keyof SiteInput>([
  "date_offre",
  "date_prise_effet_contrat",
  "date_fin_contrat",
  "date_indice_s_prime",
  "date_indice_ch_prime",
  "date_revision",
  "date_indice_s",
  "date_indice_ch",
]);

/// "4760" → "4 760,00 €" — ne touche pas aux valeurs vides ou non
/// numériques (jamais le cas en pratique, mais pas de raison de planter
/// sur une cellule mal saisie).
function formaterMontantExport(valeur: string): string {
  if (!valeur.trim()) return "";
  const n = Number(valeur.replace(",", "."));
  return Number.isFinite(n) ? eur(n) : valeur;
}

const CHAMPS_MONTANT = new Set<keyof SiteInput>([
  "montant_contrat_av",
  "taux_horaire_vendu",
  "taux_horaire_regie",
  "forfait_deplacement",
  "montant_contrat_av_revise",
  "taux_horaire_revise",
  "forfait_deplacement_revise",
]);

/// Construit une ligne complète de la feuille "SITES" pour un site
/// donné (colonnes dans le même ordre que COLONNES_SITES/ENTETES_SITES) :
/// N° Client/N° Site dérivés de n_affaire (pas de champ dédié en base),
/// téléphones au format international, dates au format JJ/MM/AAAA.
export function ligneSite(site: Record<string, unknown>): string[] {
  const ligne: string[] = new Array(NB_COLONNES_SITES).fill("");
  for (const { index, champ } of COLONNES_SITES) {
    const valeur = String(site[champ] ?? "");
    if (CHAMPS_TELEPHONE.has(champ)) ligne[index] = formaterTelInternational(valeur);
    else if (CHAMPS_DATE.has(champ)) ligne[index] = formaterDate(valeur);
    else if (CHAMPS_MONTANT.has(champ)) ligne[index] = formaterMontantExport(valeur);
    else ligne[index] = valeur;
  }
  const [numClient, numSite] = numeroClientEtSite(String(site.n_affaire ?? ""));
  ligne[3] = numClient;
  ligne[4] = numSite;
  return ligne;
}

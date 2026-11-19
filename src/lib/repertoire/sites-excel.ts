import type { SiteInput } from "@/lib/validation/site";
import { formaterDate, dateFrVersIso, telInternational, telLocal } from "@/lib/format";
import { eur } from "@/lib/commandes-fournisseur/format";

type ColonneSite = {
  titre: string;
  champ: keyof SiteInput | "item" | "n_client" | "n_site";
  alias?: string[];
};

const interlocuteur = (n: number, alias: boolean): ColonneSite[] => {
  const suffixe = n === 1 ? "" : `_${n}`;
  const ancien = (t: string) => (alias ? [t] : []);
  return [
    { titre: `Interlocuteur site ${n}`, champ: `interlocuteur_site${suffixe}` as keyof SiteInput, alias: ancien("Interlocuteur site") },
    {
      titre: `Tel Fixe Interlocuteur site ${n}`,
      champ: `tel_fixe_interlocuteur_site${suffixe}` as keyof SiteInput,
      alias: ancien("Tel Fixe Interlocuteur site"),
    },
    {
      titre: `Portable Interlocuteur site ${n}`,
      champ: `portable_interlocuteur_site${suffixe}` as keyof SiteInput,
      alias: ancien("Portable Interlocuteur site"),
    },
    {
      titre: `Courriel Interlocuteur site ${n}`,
      champ: `courriel_interlocuteur_site${suffixe}` as keyof SiteInput,
      alias: ancien("Courriel Interlocuteur site"),
    },
  ];
};

/// Colonnes de la feuille "SITES", dans l'ordre du classeur maître. L'import
/// les retrouve par leur titre (voir indexColonnesSites), jamais par leur
/// position : les alias couvrent les anciens titres (classeur maître avant
/// les interlocuteurs 2 à 4, anciens exports de l'appli).
export const COLONNES_SITES_EXCEL: ColonneSite[] = [
  { titre: "Item", champ: "item", alias: ["ITEM"] },
  { titre: "Client", champ: "nom", alias: ["Nom"] },
  { titre: "Site", champ: "site" },
  { titre: "N° Client", champ: "n_client" },
  { titre: "N°Site", champ: "n_site" },
  { titre: "N°Affaire", champ: "n_affaire" },
  { titre: "Nb Heures vendues", champ: "nb_heures_vendues" },
  { titre: "Nb Heures vendues assistant", champ: "nb_heures_vendues_assistant" },
  { titre: "Qte Heures programmer Année en cours", champ: "qte_heures_programmees", alias: ["Qté Heures Programmées"] },
  {
    titre: "Qte Heures Reste à programmer Année en cours",
    champ: "qte_heures_restantes",
    alias: ["Qté Heures Restantes à Planifier"],
  },
  { titre: "Fréq Entretien / an", champ: "freq_entretien_an" },
  { titre: "Commune site", champ: "commune", alias: ["Commune"] },
  { titre: "Code Postal site", champ: "code_postal", alias: ["Code Postal"] },
  { titre: "Adresse site", champ: "adresse", alias: ["Adresse"] },
  { titre: "Complément d'adresse site", champ: "complement_adresse", alias: ["Complément Adresse"] },
  ...interlocuteur(1, true),
  ...interlocuteur(2, false),
  ...interlocuteur(3, false),
  ...interlocuteur(4, false),
  { titre: "Responsable contrat", champ: "responsable_contrat" },
  { titre: "Tel Fixe responsable contrat", champ: "tel_fixe_responsable", alias: ["Tél Fixe Responsable"] },
  { titre: "Portable responsable contrat", champ: "portable_responsable", alias: ["Portable Responsable"] },
  { titre: "Courriel responsable contrat", champ: "courriel_responsable", alias: ["Courriel Responsable"] },
  { titre: "Commune Facturation", champ: "commune_facturation" },
  { titre: "Code Postal Facturation", champ: "code_postal_facturation" },
  { titre: "Adresse Facturation", champ: "adresse_facturation" },
  {
    titre: "Complément d'adresse Facturation",
    champ: "complement_adresse_facturation",
    alias: ["Complément Adresse Facturation"],
  },
  { titre: "Interlocuteur Facturation", champ: "interlocuteur_facturation" },
  { titre: "Tel Fixe Interlocuteur Facturation", champ: "tel_fixe_interlocuteur_facturation" },
  { titre: "Portable Interlocuteur Facturation", champ: "portable_interlocuteur_facturation" },
  { titre: "Courriel Interlocuteur Facturation", champ: "courriel_interlocuteur_facturation" },
  { titre: "Interlocuteur Tiers", champ: "interlocuteur_tiers" },
  { titre: "Tel Fixe Tiers", champ: "tel_fixe_tiers" },
  { titre: "Portable Tiers", champ: "portable_tiers" },
  { titre: "Courriel Tiers", champ: "courriel_tiers" },
  { titre: "EPI spécifique", champ: "epi_specifique" },
  { titre: "Habilitation spécifique", champ: "habilitation_specifique" },
  { titre: "Moyen accès Echaudage etc.", champ: "moyen_acces", alias: ["Moyen Accès"] },
  { titre: "Jour accès", champ: "jour_acces" },
  { titre: "Heures accès", champ: "heures_acces" },
  { titre: "Date de l'offre", champ: "date_offre", alias: ["Date Offre"] },
  { titre: "Date de prise d'effet du contrat", champ: "date_prise_effet_contrat", alias: ["Date Prise Effet Contrat"] },
  { titre: "Durée", champ: "duree_contrat", alias: ["Durée Contrat"] },
  { titre: "Montant ° Contrat + AV", champ: "montant_contrat_av", alias: ["Montant Contrat AV", "Montant Contrat + AV"] },
  { titre: "Date fin contrat", champ: "date_fin_contrat" },
  { titre: "Date Indice S°", champ: "date_indice_s_prime", alias: ["Date Indice S'"] },
  { titre: "Date Indice CH°", champ: "date_indice_ch_prime", alias: ["Date Indice Ch'"] },
  { titre: "Taux horaire vendu", champ: "taux_horaire_vendu" },
  { titre: "Taux Horaire régie", champ: "taux_horaire_regie" },
  { titre: "Forfait Déplacement", champ: "forfait_deplacement" },
  { titre: "Référence offre OGS", champ: "reference_offre_ogs" },
  { titre: "valeur indice S°", champ: "valeur_indice_s_prime", alias: ["Valeur Indice S'"] },
  { titre: "valeur indice CH°", champ: "valeur_indice_ch_prime", alias: ["Valeur Indice Ch'"] },
  { titre: "Fréq factu Annuelle", champ: "freq_factu_annuelle" },
  { titre: "Délai Intervention Heure", champ: "delai_intervention", alias: ["Délai Intervention"] },
  { titre: "Formule de révision entretien", champ: "formule_revision_entretien", alias: ["Formule Révision Entretien"] },
  { titre: "Formule de révision dépannage", champ: "formule_revision_depannage", alias: ["Formule Révision Dépannage"] },
  { titre: "Date de révision", champ: "date_revision", alias: ["Date Révision"] },
  { titre: "Date Indice S", champ: "date_indice_s" },
  { titre: "valeur indice S", champ: "valeur_indice_s" },
  { titre: "Date Indice CH", champ: "date_indice_ch" },
  { titre: "valeur indice CH", champ: "valeur_indice_ch" },
  {
    titre: "Montant Contrat + AV Applicable Révisé",
    champ: "montant_contrat_av_revise",
    alias: ["Montant Contrat AV Révisé"],
  },
  { titre: "Taux Horaire Applicable Révisé", champ: "taux_horaire_revise", alias: ["Taux Horaire Révisé"] },
  {
    titre: "Forfait Déplacement Horaire Applicable Révisé",
    champ: "forfait_deplacement_revise",
    alias: ["Forfait Déplacement Révisé"],
  },
  { titre: "Modif RI ou BG", champ: "modif_ri_ou_bg" },
  { titre: "Remarques Libres", champ: "remarques_libres" },
  { titre: "SIRET", champ: "siret" },
  { titre: "N° TVA intracommunautaire", champ: "tva_intracom" },
  { titre: "Conditions de paiement", champ: "conditions_paiement" },
];

/// Champs du site présents dans la feuille (hors Item / N° Client / N° Site,
/// dérivés de n_affaire).
export const CHAMPS_SITES_EXCEL: (keyof SiteInput)[] = COLONNES_SITES_EXCEL.map((c) => c.champ).filter(
  (c): c is keyof SiteInput => c !== "item" && c !== "n_client" && c !== "n_site",
);

export const ENTETES_SITES: string[] = COLONNES_SITES_EXCEL.map((c) => c.titre);

export const NB_COLONNES_SITES = ENTETES_SITES.length;

/// "N°Affaire", "N° Affaire", "n° affaire" → même clé ; ° et ' comptent
/// comme « prime » pour distinguer « Date Indice S° » de « Date Indice S ».
export function cleEnteteSite(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[°'’]/g, "prime")
    .replace(/[^a-z0-9]/g, "");
}

const CHAMP_PAR_CLE = new Map<string, ColonneSite["champ"]>(
  COLONNES_SITES_EXCEL.flatMap((c) => [c.titre, ...(c.alias ?? [])].map((t) => [cleEnteteSite(t), c.champ] as const)),
);

/// Lit la ligne d'en-tête : champ → n° de colonne (base 1), plus les
/// titres non reconnus (signalés à l'import, jamais importés).
export function indexColonnesSites(titres: string[]): {
  colonnes: Map<keyof SiteInput, number>;
  inconnus: string[];
} {
  const colonnes = new Map<keyof SiteInput, number>();
  const inconnus: string[] = [];
  titres.forEach((titre, i) => {
    if (!titre.trim()) return;
    const champ = CHAMP_PAR_CLE.get(cleEnteteSite(titre));
    if (!champ) {
      inconnus.push(titre.trim());
      return;
    }
    if (champ === "item" || champ === "n_client" || champ === "n_site") return;
    if (!colonnes.has(champ)) colonnes.set(champ, i + 1);
  });
  return { colonnes, inconnus };
}

/// Numéro Client / Numéro Site tels qu'affichés dans le fichier maître
/// (ex: "265-01" → "265" / "01") — dérivés de n_affaire, jamais stockés
/// séparément en base.
function numeroClientEtSite(nAffaire: string): [string, string] {
  const [numClient, numSite] = (nAffaire ?? "").split("-");
  return [numClient ?? "", numSite ?? ""];
}

export const CHAMPS_TELEPHONE = new Set<keyof SiteInput>([
  "tel_fixe_interlocuteur_site",
  "portable_interlocuteur_site",
  "tel_fixe_interlocuteur_site_2",
  "portable_interlocuteur_site_2",
  "tel_fixe_interlocuteur_site_3",
  "portable_interlocuteur_site_3",
  "tel_fixe_interlocuteur_site_4",
  "portable_interlocuteur_site_4",
  "tel_fixe_responsable",
  "portable_responsable",
  "tel_fixe_interlocuteur_facturation",
  "portable_interlocuteur_facturation",
  "tel_fixe_tiers",
  "portable_tiers",
]);

export const CHAMPS_DATE = new Set<keyof SiteInput>([
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

/// "4 760,00 €" → "4760" — inverse de formaterMontantExport.
function montantExportVersBrut(valeur: string): string {
  const nettoye = valeur.replace(/[€\s]/g, "").replace(",", ".");
  if (!nettoye) return "";
  const n = Number(nettoye);
  return Number.isFinite(n) ? String(n) : valeur;
}

export const CHAMPS_MONTANT = new Set<keyof SiteInput>([
  "montant_contrat_av",
  "taux_horaire_vendu",
  "taux_horaire_regie",
  "forfait_deplacement",
  "montant_contrat_av_revise",
  "taux_horaire_revise",
  "forfait_deplacement_revise",
]);

/// Normalise une valeur brute lue du fichier Excel (import) : reconnaît
/// les formats produits par ligneSite (export) — date FR, téléphone
/// international, montant en € — et les reconvertit vers le format
/// stocké en base ; sinon la laisse telle quelle (fichier non modifié,
/// valeur déjà au format brut, ou saisie libre).
export function normaliserValeurImportSite(champ: keyof SiteInput, valeur: string): string {
  if (CHAMPS_TELEPHONE.has(champ)) return telLocal(valeur);
  if (CHAMPS_DATE.has(champ)) return dateFrVersIso(valeur) || valeur;
  if (CHAMPS_MONTANT.has(champ)) return montantExportVersBrut(valeur);
  return valeur;
}

/// Construit une ligne complète de la feuille "SITES" pour un site
/// donné (colonnes dans l'ordre de COLONNES_SITES_EXCEL) : N° Client /
/// N° Site dérivés de n_affaire (pas de champ dédié en base), téléphones
/// au format international, dates au format JJ/MM/AAAA.
/// `heuresRestantes`, si fourni (voir calculerLignesAuditHeures),
/// remplace la valeur figée de qte_heures_restantes par le calcul en
/// direct (créneaux + BI validés vs. contrat) — jamais réimportée.
export function ligneSite(site: Record<string, unknown>, heuresRestantes?: number): string[] {
  const [numClient, numSite] = numeroClientEtSite(String(site.n_affaire ?? ""));
  return COLONNES_SITES_EXCEL.map(({ champ }) => {
    if (champ === "item") return "";
    if (champ === "n_client") return numClient;
    if (champ === "n_site") return numSite;
    if (champ === "qte_heures_restantes" && heuresRestantes !== undefined) return String(heuresRestantes);
    const valeur = String(site[champ] ?? "");
    if (CHAMPS_TELEPHONE.has(champ)) return telInternational(valeur);
    if (CHAMPS_DATE.has(champ)) return formaterDate(valeur);
    if (CHAMPS_MONTANT.has(champ)) return formaterMontantExport(valeur);
    return valeur;
  });
}

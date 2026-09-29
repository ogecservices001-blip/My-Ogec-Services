"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { siteSchema, type SiteInput } from "@/lib/validation/site";
import { COLONNES_SITES } from "@/lib/repertoire/sites-excel";
import type { ActionResult } from "@/lib/action-result";

export type LigneDiffSite = {
  donnees: SiteInput;
  statut: "ajout" | "modification";
  siteExistantId?: string;
  /// Pour une modification : [label du champ, ancienne valeur, nouvelle valeur]
  differences: [string, string, string][];
};

export type ResultatPreview =
  | { ok: true; lignes: LigneDiffSite[]; avertissements: string[] }
  | { ok: false; erreur: string };

const LABELS: Record<keyof SiteInput, string> = {
  nom: "Nom",
  site: "Site",
  n_affaire: "N° Affaire",
  commune: "Commune",
  code_postal: "Code Postal",
  adresse: "Adresse",
  complement_adresse: "Complément d'adresse",
  epi_specifique: "EPI spécifique",
  habilitation_specifique: "Habilitation spécifique",
  moyen_acces: "Moyen d'accès",
  jour_acces: "Jour d'accès",
  heures_acces: "Heures d'accès",
  delai_intervention: "Délai d'intervention",
  interlocuteur_site: "Interlocuteur site",
  tel_fixe_interlocuteur_site: "Tel Fixe interlocuteur site",
  portable_interlocuteur_site: "Portable interlocuteur site",
  courriel_interlocuteur_site: "Courriel interlocuteur site",
  freq_entretien_an: "Fréq. entretien / an",
  interlocuteur_tiers: "Interlocuteur Tiers",
  tel_fixe_tiers: "Tel Fixe Tiers",
  portable_tiers: "Portable Tiers",
  courriel_tiers: "Courriel Tiers",
  remarques_libres: "Remarques libres",
  nb_heures_vendues: "Nb Heures vendues",
  nb_heures_vendues_assistant: "Nb Heures vendues assistant",
  qte_heures_programmees: "Qté heures programmées",
  qte_heures_restantes: "Qté heures restantes",
  taux_horaire_regie: "Taux horaire régie",
  taux_horaire_vendu: "Taux horaire vendu",
  forfait_deplacement: "Forfait déplacement",
  date_offre: "Date de l'offre",
  date_prise_effet_contrat: "Date de prise d'effet",
  date_fin_contrat: "Date de fin de contrat",
  duree_contrat: "Durée",
  montant_contrat_av: "Montant Contrat + AV",
  reference_offre_ogs: "Référence offre OGS",
  responsable_contrat: "Responsable contrat",
  tel_fixe_responsable: "Tel Fixe responsable",
  portable_responsable: "Portable responsable",
  courriel_responsable: "Courriel responsable",
  adresse_facturation: "Adresse facturation",
  code_postal_facturation: "Code Postal facturation",
  commune_facturation: "Commune facturation",
  complement_adresse_facturation: "Complément d'adresse facturation",
  interlocuteur_facturation: "Interlocuteur facturation",
  tel_fixe_interlocuteur_facturation: "Tel Fixe interlocuteur facturation",
  portable_interlocuteur_facturation: "Portable interlocuteur facturation",
  courriel_interlocuteur_facturation: "Courriel interlocuteur facturation",
  freq_factu_annuelle: "Fréq. facturation annuelle",
  date_revision: "Date de révision",
  formule_revision_entretien: "Formule révision entretien",
  formule_revision_depannage: "Formule révision dépannage",
  date_indice_s: "Date Indice S",
  valeur_indice_s: "Valeur indice S",
  date_indice_ch: "Date Indice CH",
  valeur_indice_ch: "Valeur indice CH",
  date_indice_s_prime: "Date Indice S°",
  valeur_indice_s_prime: "Valeur indice S°",
  date_indice_ch_prime: "Date Indice CH°",
  valeur_indice_ch_prime: "Valeur indice CH°",
  montant_contrat_av_revise: "Montant Contrat+AV révisé",
  taux_horaire_revise: "Taux horaire révisé",
  forfait_deplacement_revise: "Forfait déplacement révisé",
  modif_ri_ou_bg: "Modif RI ou BG",
};

/// Lit le fichier Excel envoyé, extrait la feuille "SITES" (même
/// format que le classeur maître Flutter) et calcule le diff par
/// rapport aux sites déjà en base, rapprochés par N° Affaire — jamais
/// écrit en base ici, juste un aperçu pour validation.
export async function previsualiserImportSites(
  formData: FormData,
): Promise<ResultatPreview> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await fichier.arrayBuffer());
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx/.xlsm est attendu." };
  }

  const feuille = workbook.getWorksheet("SITES");
  if (!feuille) {
    return { ok: false, erreur: 'Feuille "SITES" introuvable dans ce classeur.' };
  }

  const supabase = await createClient();
  const { data: existants, error } = await supabase.from("sites").select("*");
  if (error) return { ok: false, erreur: error.message };
  const parNAffaire = new Map((existants ?? []).map((s) => [s.n_affaire, s]));

  const lignes: LigneDiffSite[] = [];
  const avertissements: string[] = [];
  const vus = new Set<string>();

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return; // en-tête

    const valeur = (index: number): string => {
      const cellule = row.getCell(index + 1); // exceljs 1-based
      const v = cellule.value;
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
      return String(v).trim();
    };

    const nAffaire = valeur(5);
    const nom = valeur(1);
    if (!nAffaire) {
      if (nom) avertissements.push(`Ligne ${numeroLigne} ("${nom}") ignorée : N° Affaire vide.`);
      return;
    }
    if (vus.has(nAffaire)) {
      avertissements.push(`N° Affaire "${nAffaire}" en double dans le fichier — seule la première occurrence est prise en compte.`);
      return;
    }
    vus.add(nAffaire);

    const brut: Record<string, string> = {};
    for (const { index, champ } of COLONNES_SITES) brut[champ] = valeur(index);
    const parsed = siteSchema.safeParse(brut);
    if (!parsed.success) {
      avertissements.push(`Ligne ${numeroLigne} ("${nom}") ignorée : ${parsed.error.issues[0]?.message}`);
      return;
    }
    const donnees = parsed.data;

    const existant = parNAffaire.get(nAffaire);
    if (!existant) {
      lignes.push({ donnees, statut: "ajout", differences: [] });
      return;
    }

    const differences: [string, string, string][] = [];
    for (const { champ } of COLONNES_SITES) {
      const nouvelle = donnees[champ];
      const ancienne = String(existant[champ as keyof typeof existant] ?? "");
      if (nouvelle && nouvelle !== ancienne) {
        differences.push([LABELS[champ], ancienne, nouvelle]);
      }
    }
    if (differences.length > 0) {
      lignes.push({ donnees, statut: "modification", siteExistantId: existant.id, differences });
    }
  });

  return { ok: true, lignes, avertissements };
}

/// Applique les lignes cochées par l'admin (ajouts + modifications),
/// telles que renvoyées par previsualiserImportSites — jamais un
/// nouveau parsing du fichier, uniquement les données déjà validées.
export async function appliquerImportSites(
  lignes: LigneDiffSite[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  const aInserer = lignes.filter((l) => l.statut === "ajout").map((l) => l.donnees);
  if (aInserer.length > 0) {
    const { error } = await supabase.from("sites").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
  }

  for (const ligne of lignes) {
    if (ligne.statut !== "modification" || !ligne.siteExistantId) continue;
    const { error } = await supabase
      .from("sites")
      .update(ligne.donnees)
      .eq("id", ligne.siteExistantId);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  revalidatePath("/repertoire/clients");
  return { ok: true, ajoutes, modifies };
}

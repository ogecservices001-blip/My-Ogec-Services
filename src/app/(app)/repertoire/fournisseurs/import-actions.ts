"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fournisseurSchema, type FournisseurInput, type Interlocuteur } from "@/lib/validation/fournisseur";
import type { ActionResult } from "@/lib/action-result";

export type LigneDiffFournisseur = {
  donnees: FournisseurInput;
  statut: "ajout" | "modification";
  fournisseurExistantId?: string;
  differences: [string, string, string][];
};

export type ResultatPreviewFournisseurs =
  | { ok: true; lignes: LigneDiffFournisseur[]; avertissements: string[] }
  | { ok: false; erreur: string };

// Champs "société" : mêmes pour toutes les lignes d'un même fournisseur
// dans le classeur (une ligne = un interlocuteur). Champs "contact" :
// propres à chaque ligne, regroupés dans `interlocuteurs`.
const EN_TETES_SOCIETE: Record<string, keyof FournisseurInput> = {
  "noms fournisseurs": "nom",
  nom: "nom",
  "dénomination courte fournisseurs": "denomination_courte",
  "dénomination courte": "denomination_courte",
  "nature fourniture": "nature_fourniture",
  adresse: "adresse",
  "complément d'adresse": "complement_adresse",
  "complément adresse": "complement_adresse",
  "code postal": "code_postal",
  ville: "commune",
  commune: "commune",
  localisation: "localisation",
  "site web": "site_web",
  "produits clés": "produits_cles",
  remarques: "remarques",
  "raison sociale exacte": "raison_sociale_exacte",
  "forme juridique": "forme_juridique",
  "siren\n(9 chiffres)": "siren",
  "siren (9 chiffres)": "siren",
  siren: "siren",
  "siret\n(14 chiffres)": "siret",
  "siret (14 chiffres)": "siret",
  siret: "siret",
  "n° tva intracom.": "tva_intracom",
  "rcs / rm\n(ville)": "rcs_rm",
  "rcs / rm (ville)": "rcs_rm",
  "délai de paiement": "delai_paiement",
  "mode de règlement": "mode_reglement",
  "cgv reçues": "cgv_recues",
  "fiche mise à jour le": "fiche_maj_le",
};

const EN_TETES_CONTACT: Record<string, keyof Interlocuteur> = {
  interlocuteurs: "nom",
  tel: "tel",
  "tél": "tel",
  "tél fixe": "tel",
  portable: "portable",
  email: "email",
  courriel: "email",
};

const LABELS: Record<keyof FournisseurInput, string> = {
  nom: "Nom",
  denomination_courte: "Dénomination courte",
  nature_fourniture: "Nature fourniture",
  interlocuteurs: "Interlocuteurs",
  site_web: "Site web",
  commune: "Ville",
  code_postal: "Code postal",
  adresse: "Adresse",
  complement_adresse: "Complément d'adresse",
  localisation: "Localisation",
  produits_cles: "Produits clés",
  remarques: "Remarques",
  raison_sociale_exacte: "Raison sociale exacte",
  forme_juridique: "Forme juridique",
  siren: "SIREN",
  siret: "SIRET",
  tva_intracom: "N° TVA intracom.",
  rcs_rm: "RCS / RM",
  delai_paiement: "Délai de paiement",
  mode_reglement: "Mode de règlement",
  cgv_recues: "CGV reçues",
  fiche_maj_le: "Fiche mise à jour le",
};

function normaliser(s: string): string {
  return s.trim().toLowerCase();
}

/// Lit une cellule quel que soit son type réel dans le classeur :
/// texte simple, texte enrichi ({richText}/{text}), formule ({formula,
/// result} ou {sharedFormula, result} — le cas des lignes "contact"
/// recopiant les infos société via INDEX/MATCH), ou date (objet Date,
/// ex. "Fiche mise à jour le").
function valeurCellule(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if ("result" in o) return valeurCellule(o.result);
    if ("richText" in o && Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("").trim();
    if ("text" in o) return String(o.text ?? "").trim();
    return "";
  }
  return String(v).trim();
}

type LigneBrute = { societe: Partial<Record<keyof FournisseurInput, string>>; contact: Partial<Interlocuteur> };

/// Classeur Excel (.xlsx/.xlsm), colonnes reconnues par en-tête — une
/// ligne par interlocuteur, plusieurs lignes possibles pour un même
/// fournisseur (même format que "Base Fournisseurs"). Les lignes d'un
/// même nom sont regroupées : la première valeur non vide rencontrée
/// l'emporte pour les champs société, chaque ligne apporte un
/// interlocuteur.
export async function previsualiserImportFournisseurs(
  formData: FormData,
): Promise<ResultatPreviewFournisseurs> {
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

  const feuille = workbook.getWorksheet("Base Fournisseurs") ?? workbook.worksheets[0];
  if (!feuille) {
    return { ok: false, erreur: "Feuille introuvable dans ce classeur." };
  }

  const ligneEntetes = feuille.getRow(1);
  const colSociete = new Map<number, keyof FournisseurInput>();
  const colContact = new Map<number, keyof Interlocuteur>();
  ligneEntetes.eachCell((cellule, index1Based) => {
    const entete = normaliser(valeurCellule(cellule.value));
    if (EN_TETES_SOCIETE[entete]) colSociete.set(index1Based, EN_TETES_SOCIETE[entete]);
    else if (EN_TETES_CONTACT[entete]) colContact.set(index1Based, EN_TETES_CONTACT[entete]);
  });
  if (![...colSociete.values()].includes("nom")) {
    return { ok: false, erreur: 'Colonne "Noms Fournisseurs" introuvable — en-têtes attendues en première ligne.' };
  }

  // --- 1. Lire toutes les lignes brutes ---
  const brutes: LigneBrute[] = [];
  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return;
    const societe: Partial<Record<keyof FournisseurInput, string>> = {};
    for (const [col, champ] of colSociete) societe[champ] = valeurCellule(row.getCell(col).value);
    const contact: Partial<Interlocuteur> = {};
    for (const [col, champ] of colContact) contact[champ] = valeurCellule(row.getCell(col).value);
    if (!societe.nom) return;
    brutes.push({ societe, contact });
  });

  // --- 2. Regrouper par nom de fournisseur ---
  const groupes = new Map<string, LigneBrute[]>();
  const ordre: string[] = [];
  for (const ligne of brutes) {
    const cle = ligne.societe.nom!.toLowerCase();
    if (!groupes.has(cle)) {
      groupes.set(cle, []);
      ordre.push(cle);
    }
    groupes.get(cle)!.push(ligne);
  }

  const supabase = await createClient();
  const { data: existants, error } = await supabase.from("fournisseurs").select("*");
  if (error) return { ok: false, erreur: error.message };
  const parNom = new Map((existants ?? []).map((f) => [f.nom.trim().toLowerCase(), f]));

  const lignesResultat: LigneDiffFournisseur[] = [];
  const avertissements: string[] = [];

  for (const cle of ordre) {
    const groupe = groupes.get(cle)!;
    const societe: Record<string, string> = {};
    for (const ligne of groupe) {
      for (const [champ, valeur] of Object.entries(ligne.societe)) {
        if (valeur && !societe[champ]) societe[champ] = valeur;
      }
    }
    const interlocuteurs: Interlocuteur[] = groupe
      .map((l) => ({ nom: l.contact.nom ?? "", tel: l.contact.tel ?? "", portable: l.contact.portable ?? "", email: l.contact.email ?? "" }))
      .filter((c) => c.nom || c.tel || c.portable || c.email);

    const parsed = fournisseurSchema.safeParse({ ...societe, interlocuteurs });
    if (!parsed.success) {
      avertissements.push(`"${groupe[0].societe.nom}" ignoré : ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const donnees = parsed.data;

    const existant = parNom.get(cle);
    if (!existant) {
      lignesResultat.push({ donnees, statut: "ajout", differences: [] });
      continue;
    }

    const differences: [string, string, string][] = [];
    for (const champ of Object.keys(societe) as (keyof FournisseurInput)[]) {
      const nouvelle = String(donnees[champ] ?? "");
      const ancienne = String(existant[champ as keyof typeof existant] ?? "");
      if (nouvelle && nouvelle !== ancienne) differences.push([LABELS[champ], ancienne, nouvelle]);
    }
    const interlocuteursExistants = JSON.stringify(existant.interlocuteurs ?? []);
    if (interlocuteurs.length > 0 && JSON.stringify(interlocuteurs) !== interlocuteursExistants) {
      differences.push([
        "Interlocuteurs",
        `${((existant.interlocuteurs as unknown as Interlocuteur[] | null) ?? []).length} contact(s)`,
        `${interlocuteurs.length} contact(s)`,
      ]);
    }
    if (differences.length > 0) {
      lignesResultat.push({ donnees, statut: "modification", fournisseurExistantId: existant.id, differences });
    }
  }

  return { ok: true, lignes: lignesResultat, avertissements };
}

export async function appliquerImportFournisseurs(
  lignes: LigneDiffFournisseur[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  const aInserer = lignes.filter((l) => l.statut === "ajout").map((l) => l.donnees);
  if (aInserer.length > 0) {
    const { error } = await supabase.from("fournisseurs").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
  }

  for (const ligne of lignes) {
    if (ligne.statut !== "modification" || !ligne.fournisseurExistantId) continue;
    const { error } = await supabase
      .from("fournisseurs")
      .update(ligne.donnees)
      .eq("id", ligne.fournisseurExistantId);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true, ajoutes, modifies };
}

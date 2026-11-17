"use server";

import ExcelJS from "exceljs";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  articlePUSchema,
  aujourdhuiISO,
  CHAMP_UNITE,
  cleArticlePU,
  libelleArticlePU,
  TITRES_PU,
  type ArticlePU,
  type ArticlePUInput,
} from "@/lib/devis/referentiel-pu";
import type { ActionResult } from "@/lib/action-result";

type LigneFichier = ArticlePUInput & { ordre: number; numeroLigne: number };

type Analyse = {
  ajouts: LigneFichier[];
  modifications: { existant: ArticlePU; ligne: LigneFichier; date: string | null }[];
  absents: ArticlePU[];
  reordonnes: { id: string; ordre: number }[];
  avertissements: string[];
  empreinte: string;
};

export type ApercuImportPU = {
  empreinte: string;
  nbLignesFichier: number;
  nbExistants: number;
  ajouts: { famille: string; libelle: string; unite: string; tarif: number | null; mo: number | null; date: string | null }[];
  modifications: {
    famille: string;
    libelle: string;
    ancienTarif: number | null;
    nouveauTarif: number | null;
    ancienneMO: number | null;
    nouvelleMO: number | null;
    ancienneDate: string | null;
    nouvelleDate: string | null;
  }[];
  absents: { famille: string; libelle: string; tarif: number | null }[];
  avertissements: string[];
};

export type ChoixImportPU = {
  ajoutsDecoches: number[];
  modificationsDecochees: number[];
  absentsCoches: number[];
};

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const ENTETES = new Map(TITRES_PU.map((t) => [normaliser(t.titre), t.cle]));

function texteCellule(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text ?? "").trim();
    if ("result" in v) return texteCellule(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v).trim();
}

function memeNombre(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

async function analyserFichier(formData: FormData): Promise<{ ok: true; analyse: Analyse; nbLignes: number; nbExistants: number } | { ok: false; erreur: string }> {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, erreur: "Aucun fichier sélectionné." };

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await fichier.arrayBuffer());
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx est attendu." };
  }
  const feuille = workbook.worksheets[0];
  if (!feuille) return { ok: false, erreur: "Classeur vide." };

  const colonnes = new Map<string, number>();
  feuille.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const cle = ENTETES.get(normaliser(texteCellule(cell.value)));
    if (cle && !colonnes.has(cle)) colonnes.set(cle, col);
  });
  const manquantes = TITRES_PU.filter((t) => t.cle !== "date_maj_tarif" && !colonnes.has(t.cle)).map((t) => `« ${t.titre} »`);
  if (manquantes.length > 0) {
    return { ok: false, erreur: `Colonne(s) introuvable(s) en ligne 1 : ${manquantes.join(", ")}.` };
  }

  const lignes: LigneFichier[] = [];
  const avertissements: string[] = [];
  const clesFichier = new Map<string, number>();

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return;
    const brut: Record<string, string> = {};
    for (const t of TITRES_PU) {
      const col = colonnes.get(t.cle);
      brut[t.cle] = col ? texteCellule(row.getCell(col).value) : "";
    }
    if (Object.values(brut).every((v) => v === "")) return;

    const parsed = articlePUSchema.safeParse(brut);
    if (!parsed.success) {
      avertissements.push(`Ligne ${numeroLigne} ignorée : ${parsed.error.issues[0]?.message}`);
      return;
    }
    const cle = cleArticlePU(parsed.data);
    const doublon = clesFichier.get(cle);
    if (doublon !== undefined) {
      avertissements.push(`Ligne ${numeroLigne} ignorée : même article que la ligne ${doublon} (${libelleArticlePU(parsed.data)}).`);
      return;
    }
    clesFichier.set(cle, numeroLigne);
    lignes.push({ ...parsed.data, ordre: lignes.length + 1, numeroLigne });
  });

  if (lignes.length === 0) return { ok: false, erreur: "Aucun article lisible dans ce fichier." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("referentiel_pu").select("*").order("ordre").order("created_at");
  if (error) return { ok: false, erreur: error.message };
  const existants = (data ?? []) as (ArticlePU & { updated_at: string })[];

  const parCle = new Map<string, ArticlePU & { updated_at: string }>();
  for (const e of existants) {
    const cle = cleArticlePU(e);
    if (!parCle.has(cle)) parCle.set(cle, e);
  }

  const aujourdhui = aujourdhuiISO();
  const ajouts: LigneFichier[] = [];
  const modifications: Analyse["modifications"] = [];
  const reordonnes: Analyse["reordonnes"] = [];
  const retrouves = new Set<string>();

  for (const ligne of lignes) {
    const existant = parCle.get(cleArticlePU(ligne));
    if (!existant) {
      ajouts.push({ ...ligne, date_maj_tarif: ligne.date_maj_tarif ?? (ligne.tarif_net_ht !== null ? aujourdhui : null) });
      continue;
    }
    retrouves.add(existant.id);
    const tarifChange = !memeNombre(existant.tarif_net_ht, ligne.tarif_net_ht);
    const ancienneDate = existant.date_maj_tarif ? existant.date_maj_tarif.slice(0, 10) : null;
    const date = ligne.date_maj_tarif ?? (tarifChange ? aujourdhui : ancienneDate);
    if (tarifChange || !memeNombre(existant.mo_heures, ligne.mo_heures) || date !== ancienneDate) {
      modifications.push({ existant, ligne, date });
    }
    if (existant.ordre !== ligne.ordre) reordonnes.push({ id: existant.id, ordre: ligne.ordre });
  }
  const absents = existants.filter((e) => !retrouves.has(e.id));

  const empreinte = createHash("sha256")
    .update(JSON.stringify([existants.map((e) => [e.id, e.updated_at]), lignes]))
    .digest("hex");

  return {
    ok: true,
    nbLignes: lignes.length,
    nbExistants: existants.length,
    analyse: { ajouts, modifications, absents, reordonnes, avertissements, empreinte },
  };
}

export async function previsualiserImportPU(formData: FormData): Promise<{ ok: true; apercu: ApercuImportPU } | { ok: false; erreur: string }> {
  await requireAdmin();
  const res = await analyserFichier(formData);
  if (!res.ok) return res;
  const { analyse } = res;
  return {
    ok: true,
    apercu: {
      empreinte: analyse.empreinte,
      nbLignesFichier: res.nbLignes,
      nbExistants: res.nbExistants,
      ajouts: analyse.ajouts.map((l) => ({
        famille: l.famille,
        libelle: libelleArticlePU(l),
        unite: l[CHAMP_UNITE],
        tarif: l.tarif_net_ht,
        mo: l.mo_heures,
        date: l.date_maj_tarif,
      })),
      modifications: analyse.modifications.map((m) => ({
        famille: m.ligne.famille,
        libelle: libelleArticlePU(m.ligne),
        ancienTarif: m.existant.tarif_net_ht,
        nouveauTarif: m.ligne.tarif_net_ht,
        ancienneMO: m.existant.mo_heures,
        nouvelleMO: m.ligne.mo_heures,
        ancienneDate: m.existant.date_maj_tarif ? m.existant.date_maj_tarif.slice(0, 10) : null,
        nouvelleDate: m.date,
      })),
      absents: analyse.absents.map((e) => ({ famille: e.famille, libelle: libelleArticlePU(e), tarif: e.tarif_net_ht })),
      avertissements: analyse.avertissements,
    },
  };
}

export async function appliquerImportPU(
  formData: FormData,
  choix: ChoixImportPU,
  empreinte: string,
): Promise<ActionResult & { ajoutes?: number; modifies?: number; supprimes?: number }> {
  await requireAdmin();
  const res = await analyserFichier(formData);
  if (!res.ok) return res;
  const { analyse } = res;
  if (analyse.empreinte !== empreinte) {
    return { ok: false, erreur: "Le référentiel ou le fichier a changé depuis l'analyse : relance l'analyse avant d'appliquer." };
  }

  const ajoutsDecoches = new Set(choix.ajoutsDecoches);
  const modificationsDecochees = new Set(choix.modificationsDecochees);
  const absentsCoches = new Set(choix.absentsCoches);
  const supabase = await createClient();

  const aInserer = analyse.ajouts
    .filter((_, i) => !ajoutsDecoches.has(i))
    .map((l) => ({
      ordre: l.ordre,
      famille: l.famille,
      type: l.type,
      donnee1: l.donnee1,
      donnee2: l.donnee2,
      donnee3: l.donnee3,
      donnee4: l.donnee4,
      donnee5: l.donnee5,
      donnee6: l.donnee6,
      tarif_net_ht: l.tarif_net_ht,
      mo_heures: l.mo_heures,
      date_maj_tarif: l.date_maj_tarif,
    }));
  for (let i = 0; i < aInserer.length; i += 500) {
    const { error } = await supabase.from("referentiel_pu").insert(aInserer.slice(i, i + 500));
    if (error) return { ok: false, erreur: error.message };
  }

  const ordreParId = new Map(analyse.reordonnes.map((r) => [r.id, r.ordre]));
  const miseAJour = new Map<
    string,
    { tarif_net_ht?: number | null; mo_heures?: number | null; date_maj_tarif?: string | null; ordre?: number }
  >();
  analyse.modifications.forEach((m, i) => {
    if (modificationsDecochees.has(i)) return;
    miseAJour.set(m.existant.id, { tarif_net_ht: m.ligne.tarif_net_ht, mo_heures: m.ligne.mo_heures, date_maj_tarif: m.date });
  });
  for (const [id, ordre] of ordreParId) miseAJour.set(id, { ...(miseAJour.get(id) ?? {}), ordre });

  const entrees = [...miseAJour.entries()];
  for (let i = 0; i < entrees.length; i += 20) {
    const resultats = await Promise.all(
      entrees.slice(i, i + 20).map(([id, valeurs]) => supabase.from("referentiel_pu").update(valeurs).eq("id", id)),
    );
    const echec = resultats.find((r) => r.error);
    if (echec?.error) return { ok: false, erreur: echec.error.message };
  }

  const aSupprimer = analyse.absents.filter((_, i) => absentsCoches.has(i)).map((e) => e.id);
  for (let i = 0; i < aSupprimer.length; i += 500) {
    const { error } = await supabase.from("referentiel_pu").delete().in("id", aSupprimer.slice(i, i + 500));
    if (error) return { ok: false, erreur: error.message };
  }

  revalidatePath("/devis/referentiel-pu");
  return {
    ok: true,
    ajoutes: aInserer.length,
    modifies: analyse.modifications.filter((_, i) => !modificationsDecochees.has(i)).length,
    supprimes: aSupprimer.length,
  };
}

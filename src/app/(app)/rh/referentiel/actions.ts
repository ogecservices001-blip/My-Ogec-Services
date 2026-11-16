"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { finaliserFeuille } from "@/lib/excel-export";
import {
  REFERENTIELS,
  afficherValeur,
  convertirValeur,
  formaterCommune,
  normaliserCle,
  type CodeReferentiel,
  type ColonneRef,
} from "@/lib/rh/referentiels";

type Ligne = Record<string, unknown>;
type Options = Record<string, { valeur: string; label: string }[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

export async function chargerOptions(supabase: Supa): Promise<Options & { communesSites: { valeur: string; label: string }[] }> {
  const [{ data: profils }, { data: postes }, { data: sites }, { data: salaries }, { data: motifs }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("role", ["admin", "technicien", "en_attente"]).order("name"),
    supabase.from("postes_hors_client").select("id, client, site").eq("client", "Absence").order("item"),
    supabase.from("sites").select("commune"),
    supabase.from("rh_salaries").select("id, nom_paie").eq("categorie", "administratif").order("nom_paie"),
    supabase.from("rh_motifs_absence").select("id, motif").order("ordre"),
  ]);
  const communes = [...new Set(((sites ?? []) as { commune: string }[]).map((s) => s.commune.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  return {
    profils: ((profils ?? []) as { id: string; name: string }[]).map((p) => ({ valeur: p.id, label: p.name })),
    postes_absence: ((postes ?? []) as { id: string; site: string }[]).map((p) => ({ valeur: p.id, label: `Absence — ${p.site}` })),
    salaries_admin: ((salaries ?? []) as { id: string; nom_paie: string }[]).map((s) => ({ valeur: s.id, label: s.nom_paie })),
    motifs: ((motifs ?? []) as { id: string; motif: string }[]).map((m) => ({ valeur: m.id, label: m.motif })),
    communesSites: communes.map((c) => ({ valeur: c, label: c })),
  };
}

export async function chargerLignes(supabase: Supa, code: CodeReferentiel): Promise<Ligne[]> {
  const def = REFERENTIELS[code];
  const { data } = await supabase.from(def.table).select("*").order(def.tri.colonne, { ascending: def.tri.asc });
  return (data ?? []) as Ligne[];
}

function optionsDe(col: ColonneRef, options: Options) {
  return col.options ?? (col.optionsDynamiques ? options[col.optionsDynamiques] ?? [] : []);
}

/// Valeurs d'une ligne (écran ou Excel) → données à enregistrer.
function preparer(code: CodeReferentiel, brut: Record<string, unknown>, options: Options, communesSites: string[]) {
  const def = REFERENTIELS[code];
  const valeurs: Ligne = {};
  for (const col of def.colonnes) {
    let v = brut[col.cle];
    if (col.type === "choix" && v !== undefined && v !== null && v !== "") {
      const opts = optionsDe(col, options);
      const trouve = opts.find((o) => o.valeur === v || normaliserCle(o.label) === normaliserCle(v));
      if (!trouve) return { ok: false as const, erreur: `${col.entete} : « ${String(v)} » inconnu.` };
      v = trouve.valeur;
    }
    const r = convertirValeur(col, v);
    if (!r.ok) return r;
    valeurs[col.cle] = col.type === "commune" ? formaterCommune(String(r.valeur), communesSites) : col.type === "choix" && r.valeur === "" ? null : r.valeur;
  }
  return { ok: true as const, valeurs };
}

export async function enregistrerLigne(code: CodeReferentiel, idExistant: string | null, brut: Record<string, unknown>): Promise<ActionResult> {
  await requireAdmin();
  const def = REFERENTIELS[code];
  const supabase = await createClient();
  const options = await chargerOptions(supabase);
  const prep = preparer(code, brut, options, options.communesSites.map((c) => c.valeur));
  if (!prep.ok) return { ok: false, erreur: prep.erreur };

  // Barème : code postal repris de l'adresse des sites quand il n'est pas saisi.
  if (code === "bareme" && !String(prep.valeurs.code_postal ?? "").trim()) {
    const { data: sites } = await supabase.from("sites").select("commune, code_postal").neq("code_postal", "");
    const compte = new Map<string, number>();
    for (const s of (sites ?? []) as { commune: string; code_postal: string }[]) {
      if (normaliserCle(s.commune) === normaliserCle(prep.valeurs.commune)) compte.set(s.code_postal.trim(), (compte.get(s.code_postal.trim()) ?? 0) + 1);
    }
    const plusFrequent = [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (plusFrequent) prep.valeurs.code_postal = plusFrequent;
  }
  if (code === "absences-admin" && String(prep.valeurs.date_fin) < String(prep.valeurs.date_debut)) {
    return { ok: false, erreur: "La date de fin est avant la date de début." };
  }
  const existantes = def.cle === def.id ? [] : await chargerLignes(supabase, code);
  const doublon = existantes.find(
    (l) => normaliserCle(l[def.cle]) === normaliserCle(prep.valeurs[def.cle]) && String(l[def.id]) !== String(idExistant ?? ""),
  );
  if (doublon) return { ok: false, erreur: `« ${afficherValeur(def.colonnes.find((c) => c.cle === def.cle)!, prep.valeurs[def.cle])} » existe déjà.` };

  const { error } = idExistant
    ? await supabase.from(def.table).update(prep.valeurs).eq(def.id, idExistant)
    : await supabase.from(def.table).insert(prep.valeurs);
  if (error) return { ok: false, erreur: error.message.includes("duplicate") ? "Cette ligne existe déjà." : error.message };
  revalidatePath(`/rh/referentiel/${code}`);
  return { ok: true };
}

export async function supprimerLigne(code: CodeReferentiel, id: string): Promise<ActionResult> {
  await requireAdmin();
  const def = REFERENTIELS[code];
  const supabase = await createClient();
  const { data, error } = await supabase.from(def.table).delete().eq(def.id, id).select(def.id);
  if (error) return { ok: false, erreur: error.message };
  if (!data || data.length === 0) return { ok: false, erreur: "Rien n'a été supprimé." };
  revalidatePath(`/rh/referentiel/${code}`);
  return { ok: true };
}

// ---------------------------------------------------------------- Excel

export async function exporterReferentiel(code: CodeReferentiel): Promise<string> {
  await requireAdmin();
  const def = REFERENTIELS[code];
  const supabase = await createClient();
  const [lignes, options] = await Promise.all([chargerLignes(supabase, code), chargerOptions(supabase)]);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(def.titre.slice(0, 31));
  ws.addRow(def.colonnes.map((c) => c.entete));
  for (const l of lignes) ws.addRow(def.colonnes.map((c) => afficherValeur(c, l[c.cle], optionsDe(c, options))));
  finaliserFeuille(ws);
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
}

type Changement = { cle: string; type: "ajout" | "modification"; champs: { entete: string; avant: string; apres: string }[]; valeurs: Ligne; id: string | null };
export type ApercuImportRh =
  | { ok: true; changements: Omit<Changement, "valeurs" | "id">[]; erreurs: string[]; inchangees: number; rapport: string }
  | { ok: false; erreur: string };

async function analyserFichier(code: CodeReferentiel, formData: FormData) {
  const def = REFERENTIELS[code];
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false as const, erreur: "Aucun fichier sélectionné." };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await fichier.arrayBuffer());
  } catch {
    return { ok: false as const, erreur: "Fichier illisible : un .xlsx est attendu (celui de l'export)." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false as const, erreur: "Classeur vide." };
  const colParCle = new Map<string, number>();
  ws.getRow(1).eachCell((cell, n) => {
    const col = def.colonnes.find((c) => normaliserCle(c.entete) === normaliserCle(cell.text));
    if (col) colParCle.set(col.cle, n);
  });
  if (!colParCle.has(def.cle)) return { ok: false as const, erreur: `Colonne « ${def.colonnes.find((c) => c.cle === def.cle)!.entete} » introuvable : pars du fichier de l'export.` };

  const supabase = await createClient();
  const [existantes, options] = await Promise.all([chargerLignes(supabase, code), chargerOptions(supabase)]);
  const communesSites = options.communesSites.map((c) => c.valeur);
  const parCle = new Map(existantes.map((l) => [normaliserCle(l[def.cle]), l]));
  const vues = new Set<string>();
  const changements: Changement[] = [];
  const erreurs: string[] = [];
  let inchangees = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const brut: Record<string, unknown> = {};
    for (const col of def.colonnes) {
      const i = colParCle.get(col.cle);
      if (!i) continue;
      const cell = row.getCell(i);
      brut[col.cle] = cell.value instanceof Date ? cell.value : cell.text;
    }
    if (def.colonnes.every((c) => !String(brut[c.cle] ?? "").trim())) return;
    const prep = preparer(code, brut, options, communesSites);
    if (!prep.ok) return void erreurs.push(`Ligne ${n} : ${prep.erreur}`);
    const cle = normaliserCle(prep.valeurs[def.cle]);
    if (vues.has(cle)) return void erreurs.push(`Ligne ${n} : « ${String(prep.valeurs[def.cle])} » en double dans le fichier, ignorée.`);
    vues.add(cle);
    const existante = parCle.get(cle);
    const champs = def.colonnes
      .filter((c) => colParCle.has(c.cle))
      .map((c) => ({
        entete: c.entete,
        avant: existante ? afficherValeur(c, existante[c.cle], optionsDe(c, options)) : "",
        apres: afficherValeur(c, prep.valeurs[c.cle], optionsDe(c, options)),
      }));
    const valeurs = Object.fromEntries(def.colonnes.filter((c) => colParCle.has(c.cle)).map((c) => [c.cle, prep.valeurs[c.cle]]));
    const libelle = String(afficherValeur(def.colonnes.find((c) => c.cle === def.cle)!, prep.valeurs[def.cle]));
    if (!existante) changements.push({ cle: libelle, type: "ajout", champs, valeurs, id: null });
    else {
      const modifies = champs.filter((c) => c.avant !== c.apres);
      if (modifies.length === 0) inchangees++;
      else changements.push({ cle: libelle, type: "modification", champs: modifies, valeurs, id: String(existante[def.id]) });
    }
  });
  return { ok: true as const, changements, erreurs, inchangees, supabase };
}

async function rapportExcel(code: CodeReferentiel, changements: Changement[], erreurs: string[]): Promise<string> {
  const def = REFERENTIELS[code];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rapport d'import");
  ws.addRow(["Résultat", def.colonnes.find((c) => c.cle === def.cle)!.entete, "Champ", "Nouvelle valeur", "Ancienne valeur"]);
  const ROUGE = { color: { argb: "FFCC0000" }, bold: true };
  for (const c of changements) {
    for (const ch of c.champs) {
      const row = ws.addRow([c.type === "ajout" ? "Ajouté" : "Modifié", c.cle, ch.entete, ch.apres, c.type === "ajout" ? "" : ch.avant || "vide"]);
      if (c.type === "ajout") row.eachCell((cell) => (cell.font = ROUGE));
      else row.getCell(4).font = ROUGE;
    }
  }
  if (changements.length === 0) ws.addRow(["Aucun changement : le référentiel est déjà à jour."]);
  finaliserFeuille(ws);
  if (erreurs.length) {
    const we = wb.addWorksheet("Lignes ignorées");
    we.addRow(["Message"]);
    for (const e of erreurs) we.addRow([e]);
    finaliserFeuille(we);
  }
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
}

export async function previsualiserImportRh(code: CodeReferentiel, formData: FormData): Promise<ApercuImportRh> {
  await requireAdmin();
  const r = await analyserFichier(code, formData);
  if (!r.ok) return r;
  return {
    ok: true,
    changements: r.changements.map(({ cle, type, champs }) => ({ cle, type, champs })),
    erreurs: r.erreurs,
    inchangees: r.inchangees,
    rapport: await rapportExcel(code, r.changements, r.erreurs),
  };
}

/// Import : ajoute et modifie, ne supprime jamais une ligne absente du fichier.
export async function appliquerImportRh(code: CodeReferentiel, formData: FormData): Promise<{ ok: true; ajouts: number; modifications: number } | { ok: false; erreur: string }> {
  await requireAdmin();
  const def = REFERENTIELS[code];
  const r = await analyserFichier(code, formData);
  if (!r.ok) return r;
  let ajouts = 0;
  let modifications = 0;
  for (const c of r.changements) {
    const { error } = c.id ? await r.supabase.from(def.table).update(c.valeurs).eq(def.id, c.id) : await r.supabase.from(def.table).insert(c.valeurs);
    if (error) return { ok: false, erreur: `${c.cle} : ${error.message}` };
    if (c.id) modifications++;
    else ajouts++;
  }
  revalidatePath(`/rh/referentiel/${code}`);
  return { ok: true, ajouts, modifications };
}

// ---------------------------------------------------------------- Paramètres de paie

export type ParametresPaie = {
  duree_legale_hebdo: number;
  plafond_hs25_hebdo: number;
  panier_montant: number;
  panier_seuil_heures: number;
  horaire_lundi: number;
  horaire_mardi: number;
  horaire_mercredi: number;
  horaire_jeudi: number;
  horaire_vendredi: number;
};

export async function enregistrerParametresPaie(p: Record<keyof ParametresPaie, string>): Promise<ActionResult> {
  await requireAdmin();
  const valeurs: Partial<ParametresPaie> = {};
  for (const [k, v] of Object.entries(p) as [keyof ParametresPaie, string][]) {
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return { ok: false, erreur: "Toutes les valeurs doivent être des nombres positifs.", champs: { [k]: "Nombre attendu" } };
    valeurs[k] = n;
  }
  if ((valeurs.plafond_hs25_hebdo ?? 0) < (valeurs.duree_legale_hebdo ?? 0)) {
    return { ok: false, erreur: "Le plafond des heures à 25 % doit être supérieur ou égal à la durée légale.", champs: { plafond_hs25_hebdo: "Trop bas" } };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("rh_parametres").update({ ...valeurs, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/rh/referentiel/parametres");
  return { ok: true };
}

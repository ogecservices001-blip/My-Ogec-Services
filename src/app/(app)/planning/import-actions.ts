"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { cleCreneau, type LignePlanningImport } from "@/lib/planning/export-import";

export type DiffAjoutCreneau = {
  ligne: LignePlanningImport;
  siteId: string | null;
  devisId: string | null;
  posteHorsClientId: string | null;
  clientNom: string;
  site: string;
  technicienIds: string[];
};

export type DiffModificationCreneau = DiffAjoutCreneau & {
  existantId: string;
  champs: { label: string; ancienne: string; nouvelle: string }[];
};

export type ResultatDiffPlanning = {
  ajouts: DiffAjoutCreneau[];
  modifications: DiffModificationCreneau[];
  avertissements: { message: string }[];
};

function normaliser(s: string): string {
  return s.trim().toLowerCase();
}

async function parserFichier(fichier: File): Promise<LignePlanningImport[] | null> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await fichier.arrayBuffer());
  const feuille = workbook.worksheets[0];
  if (!feuille) return null;

  const indexParEntete = new Map<string, number>();
  feuille.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const texte = normaliser(String(cell.value ?? ""));
    if (texte) indexParEntete.set(texte, col);
  });

  function texte(row: ExcelJS.Row, entete: string): string {
    const col = indexParEntete.get(entete);
    if (!col) return "";
    const v = row.getCell(col).value;
    if (v === null || v === undefined) return "";
    if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
    return String(v).trim();
  }

  function dateISO(row: ExcelJS.Row, entete: string): string {
    const col = indexParEntete.get(entete);
    if (!col) return "";
    const v = row.getCell(col).value;
    if (v instanceof Date) {
      return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
    }
    const s = String(v ?? "").trim();
    // accepte aussi "JJ/MM/AAAA" si le fichier a été modifié en texte
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return "";
  }

  const lignes: LignePlanningImport[] = [];
  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return;
    const client = texte(row, "client");
    const date = dateISO(row, "date");
    if (!client || !date) return;

    const heuresBrut = texte(row, "heures prévues").replace(",", ".");
    const heuresPrevues = Number(heuresBrut);

    lignes.push({
      numeroLigne,
      client,
      site: texte(row, "site"),
      numeroAffaire: texte(row, "n° affaire"),
      date,
      heuresPrevues: Number.isFinite(heuresPrevues) ? heuresPrevues : 0,
      intervenants: ["intervenant 1", "intervenant 2", "intervenant 3", "intervenant 4"]
        .map((e) => texte(row, e))
        .filter(Boolean),
    });
  });

  return lignes;
}

export type ResultatPreviewPlanning = { ok: true; diff: ResultatDiffPlanning } | { ok: false; erreur: string };

export async function previsualiserImportPlanning(formData: FormData): Promise<ResultatPreviewPlanning> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  let lignes: LignePlanningImport[] | null;
  try {
    lignes = await parserFichier(fichier);
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx est attendu." };
  }
  if (!lignes || lignes.length === 0) return { ok: false, erreur: "Classeur vide ou format non reconnu." };

  const supabase = await createClient();
  const [{ data: sites }, { data: devis }, { data: postes }, { data: techniciens }, { data: existants }] = await Promise.all([
    supabase.from("sites").select("id, nom, site, n_affaire"),
    supabase.from("devis").select("id, numero, site_id"),
    supabase.from("postes_hors_client").select("id, client, site"),
    supabase.from("profiles").select("id, name").in("role", ["technicien", "en_attente"]),
    supabase
      .from("creneaux_planning")
      .select("id, site_id, devis_id, poste_hors_client_id, date, heures_prevues, creneau_techniciens(technicien_id)")
      .eq("annule", false),
  ]);

  const siteParNAffaire = new Map((sites ?? []).map((s) => [normaliser(s.n_affaire), s]));
  const devisParNumero = new Map((devis ?? []).map((d) => [normaliser(d.numero), d]));
  const posteParClientSite = new Map((postes ?? []).map((p) => [`${normaliser(p.client)}|${normaliser(p.site)}`, p]));
  const technicienParNom = new Map((techniciens ?? []).map((t) => [normaliser(t.name), t]));

  const existantsParCle = new Map<string, (typeof existants extends (infer T)[] | null ? T : never)>();
  for (const e of existants ?? []) {
    const cle = cleCreneau({ date: e.date, siteId: e.site_id, devisId: e.devis_id, posteHorsClientId: e.poste_hors_client_id });
    existantsParCle.set(cle, e);
  }

  const ajouts: DiffAjoutCreneau[] = [];
  const modifications: DiffModificationCreneau[] = [];
  const avertissements: { message: string }[] = [];

  for (const ligne of lignes) {
    let siteId: string | null = null;
    let devisId: string | null = null;
    let posteHorsClientId: string | null = null;
    let clientNom = ligne.client;
    let site = ligne.site;

    const poste = posteParClientSite.get(`${normaliser(ligne.client)}|${normaliser(ligne.site)}`);
    if (poste) {
      posteHorsClientId = poste.id;
      clientNom = poste.client;
      site = poste.site;
    } else if (ligne.numeroAffaire.toUpperCase().startsWith("D-")) {
      const d = devisParNumero.get(normaliser(ligne.numeroAffaire));
      if (!d) {
        avertissements.push({ message: `Ligne ${ligne.numeroLigne} : devis "${ligne.numeroAffaire}" introuvable — ignorée.` });
        continue;
      }
      devisId = d.id;
      siteId = d.site_id;
    } else {
      const s = siteParNAffaire.get(normaliser(ligne.numeroAffaire));
      if (!s) {
        avertissements.push({ message: `Ligne ${ligne.numeroLigne} : ni poste hors client "${ligne.client} — ${ligne.site}" ni N° Affaire "${ligne.numeroAffaire}" introuvables — ignorée.` });
        continue;
      }
      siteId = s.id;
      clientNom = s.nom;
      site = s.site;
    }

    const technicienIds: string[] = [];
    for (const nom of ligne.intervenants) {
      const t = technicienParNom.get(normaliser(nom));
      if (!t) {
        avertissements.push({ message: `Ligne ${ligne.numeroLigne} : intervenant "${nom}" inconnu — ignoré.` });
        continue;
      }
      technicienIds.push(t.id);
    }
    if (technicienIds.length === 0) {
      avertissements.push({ message: `Ligne ${ligne.numeroLigne} : aucun intervenant reconnu — ligne ignorée.` });
      continue;
    }

    const cle = cleCreneau({ date: ligne.date, siteId, devisId, posteHorsClientId });
    const existant = existantsParCle.get(cle);

    const base: DiffAjoutCreneau = { ligne, siteId, devisId, posteHorsClientId, clientNom, site, technicienIds };

    if (!existant) {
      ajouts.push(base);
      continue;
    }

    const technicienIdsExistants = new Set((existant.creneau_techniciens ?? []).map((t) => t.technicien_id));
    const memesTechniciens =
      technicienIdsExistants.size === technicienIds.length && technicienIds.every((id) => technicienIdsExistants.has(id));
    const memesHeures = Number(existant.heures_prevues) === ligne.heuresPrevues;

    if (memesTechniciens && memesHeures) continue; // rien à changer

    const champs: { label: string; ancienne: string; nouvelle: string }[] = [];
    if (!memesHeures) champs.push({ label: "Heures prévues", ancienne: String(existant.heures_prevues), nouvelle: String(ligne.heuresPrevues) });
    if (!memesTechniciens) champs.push({ label: "Intervenants", ancienne: `${technicienIdsExistants.size} technicien(s)`, nouvelle: ligne.intervenants.join(", ") });

    modifications.push({ ...base, existantId: existant.id, champs });
  }

  return { ok: true, diff: { ajouts, modifications, avertissements } };
}

export async function appliquerImportPlanning(
  diff: ResultatDiffPlanning,
  selection: { ajouts: boolean[]; modifications: boolean[] },
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  const profile = await requireAdmin();
  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  for (const [i, a] of diff.ajouts.entries()) {
    if (!selection.ajouts[i]) continue;
    const { data: creneau, error } = await supabase
      .from("creneaux_planning")
      .insert({
        site_id: a.siteId,
        devis_id: a.devisId,
        poste_hors_client_id: a.posteHorsClientId,
        client_nom: a.clientNom,
        site: a.site,
        date: a.ligne.date,
        heures_prevues: a.ligne.heuresPrevues,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error || !creneau) return { ok: false, erreur: error?.message ?? `Échec à la ligne ${a.ligne.numeroLigne} (jour férié/week-end ?).` };
    const { error: errTech } = await supabase
      .from("creneau_techniciens")
      .insert(a.technicienIds.map((technicien_id) => ({ creneau_id: creneau.id, technicien_id })));
    if (errTech) {
      await supabase.from("creneaux_planning").delete().eq("id", creneau.id);
      return { ok: false, erreur: errTech.message };
    }
    ajoutes++;
  }

  for (const [i, m] of diff.modifications.entries()) {
    if (!selection.modifications[i]) continue;
    const { error } = await supabase
      .from("creneaux_planning")
      .update({ heures_prevues: m.ligne.heuresPrevues })
      .eq("id", m.existantId);
    if (error) return { ok: false, erreur: error.message };
    await supabase.from("creneau_techniciens").delete().eq("creneau_id", m.existantId);
    const { error: errTech } = await supabase
      .from("creneau_techniciens")
      .insert(m.technicienIds.map((technicien_id) => ({ creneau_id: m.existantId, technicien_id })));
    if (errTech) return { ok: false, erreur: errTech.message };
    modifies++;
  }

  revalidatePath("/planning");
  revalidatePath("/planning/mon-planning");
  return { ok: true, ajoutes, modifies };
}

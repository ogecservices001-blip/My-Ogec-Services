"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { finaliserFeuille } from "@/lib/excel-export";
import { calculerPointage, type LignePointage } from "@/lib/rh/pointage";

const moisValide = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/// Pointage du mois : figé s'il est clôturé, recalculé sinon.
export async function lignesDuMois(mois: string): Promise<{ lignes: LignePointage[]; cloture: { le: string; par: string } | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: cloture } = await supabase.from("rh_clotures").select("*").eq("mois", mois).maybeSingle();
  if (cloture) return { lignes: (cloture.lignes as LignePointage[]) ?? [], cloture: { le: cloture.cloture_le, par: cloture.cloture_par } };
  return { lignes: (await calculerPointage(supabase, mois)).lignes, cloture: null };
}

export async function basculerVehiculePersonnel(profileId: string, date: string, valeur: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: cloture } = await supabase.from("rh_clotures").select("mois").eq("mois", date.slice(0, 7)).maybeSingle();
  if (cloture) return { ok: false, erreur: "Ce mois est clôturé : rouvre-le pour le modifier." };
  const { error } = await supabase
    .from("rh_pointage_ajustements")
    .upsert({ profile_id: profileId, date, vehicule_personnel: valeur, updated_at: new Date().toISOString() }, { onConflict: "profile_id,date" });
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/rh/pointage");
  return { ok: true };
}

export async function cloturerMois(mois: string): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (!moisValide(mois)) return { ok: false, erreur: "Mois invalide." };
  const supabase = await createClient();
  const { lignes } = await calculerPointage(supabase, mois);
  const { error } = await supabase.from("rh_clotures").insert({ mois, cloture_par: profile.name, lignes });
  if (error) return { ok: false, erreur: error.message.includes("duplicate") ? "Ce mois est déjà clôturé." : error.message };
  revalidatePath("/rh/pointage");
  return { ok: true };
}

export async function rouvrirMois(mois: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("rh_clotures").delete().eq("mois", mois);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/rh/pointage");
  return { ok: true };
}

const POLES_LIBELLE: Record<string, string> = { "": "" };

/// Export au format de la feuille « Pointage Mensuel Modèle » (18 colonnes).
export async function exporterPointage(mois: string): Promise<string> {
  const { lignes } = await lignesDuMois(mois);
  const wb = new ExcelJS.Workbook();
  const [an, m] = mois.split("-");
  const ws = wb.addWorksheet(`Pointage Mensuel ${m} ${an}`);
  ws.addRow([
    "Jour mois années",
    "Mois",
    "Semaine",
    "Salariés",
    "Noms Clients",
    "Noms site",
    "N°Affaire",
    "Poles",
    "Communes",
    "Heures Normales",
    "H.S. 25%",
    "H.S. 50%",
    "H.S. 100%",
    "Nb Panier",
    "Panier Montant",
    "Prime Trajet",
    "Prime Transport",
    "Valeur Prime Transport",
  ]);
  ws.getRow(1).font = { bold: true };
  for (const l of lignes) {
    ws.addRow([
      l.date.split("-").reverse().join("/"),
      l.mois,
      l.semaine,
      l.salarie,
      l.client,
      l.site,
      l.nAffaire,
      POLES_LIBELLE[l.pole] ?? l.pole,
      l.commune || (l.source === "planning" || l.source === "bi" || l.source === "depannage" ? "Entrée la commune" : ""),
      l.hn || "",
      l.hs25 || "",
      l.hs50 || "",
      l.hs100 || "",
      l.panierNb || "",
      l.panierMontant || "",
      l.trajet || "",
      l.vehiculePerso ? "Oui" : "",
      l.transport || "",
    ]);
  }
  finaliserFeuille(ws);
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
}

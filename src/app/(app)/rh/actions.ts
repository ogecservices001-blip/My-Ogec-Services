"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { finaliserFeuille } from "@/lib/excel-export";
import { calculerPointage, type LignePointage } from "@/lib/rh/pointage";
import { chargerEtatPreparatoire, finDuMois } from "@/lib/rh/etat";

const moisValide = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/// Pointage du mois : figé jusqu'à la date d'arrêté s'il est clôturé (les jours
/// suivants restent recalculés, pour les régularisations du mois d'après).
export async function lignesDuMois(mois: string): Promise<{ lignes: LignePointage[]; cloture: { le: string; par: string; dateArrete: string } | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: cloture } = await supabase.from("rh_clotures").select("*").eq("mois", mois).maybeSingle();
  if (!cloture) return { lignes: (await calculerPointage(supabase, mois)).lignes, cloture: null };
  const dateArrete = cloture.date_arrete ?? finDuMois(mois);
  const figees = ((cloture.lignes as LignePointage[]) ?? []).filter((l) => l.date <= dateArrete);
  const suivantes = dateArrete < finDuMois(mois) ? (await calculerPointage(supabase, mois)).lignes.filter((l) => l.date > dateArrete) : [];
  return {
    lignes: [...figees, ...suivantes].sort((a, b) => a.salarie.localeCompare(b.salarie, "fr") || a.date.localeCompare(b.date)),
    cloture: { le: cloture.cloture_le, par: cloture.cloture_par, dateArrete },
  };
}

export async function basculerVehiculePersonnel(profileId: string, date: string, valeur: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: cloture } = await supabase.from("rh_clotures").select("mois, date_arrete").eq("mois", date.slice(0, 7)).maybeSingle();
  if (cloture && date <= (cloture.date_arrete ?? finDuMois(cloture.mois))) return { ok: false, erreur: "Ce jour est dans la période déjà envoyée à la RH : rouvre le mois pour le modifier." };
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
  const [{ lignes }, etat] = await Promise.all([calculerPointage(supabase, mois), chargerEtatPreparatoire(supabase, mois)]);
  const { error } = await supabase.from("rh_clotures").insert({ mois, cloture_par: profile.name, lignes, date_arrete: etat.dateArrete, etat: etat.lignes });
  if (error) return { ok: false, erreur: error.message.includes("duplicate") ? "Ce mois est déjà clôturé." : error.message };
  revalidatePath("/rh/pointage");
  revalidatePath("/rh/etat");
  return { ok: true };
}

export async function rouvrirMois(mois: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("rh_clotures").delete().eq("mois", mois);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/rh/pointage");
  revalidatePath("/rh/etat");
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { chargerEtatPreparatoire, finDuMois } from "@/lib/rh/etat";
import { classeurEtat } from "@/lib/rh/etat-export";
import { pdfEtat } from "@/lib/rh/etat-pdf";

const moisValide = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

async function brouillonModifiable(mois: string) {
  const supabase = await createClient();
  const { data: cloture } = await supabase.from("rh_clotures").select("mois").eq("mois", mois).maybeSingle();
  if (cloture) return { supabase, erreur: "Ce mois est clôturé : rouvre-le dans le Pointage mensuel pour le modifier." };
  const { data } = await supabase.from("rh_etats_preparatoires").select("date_arrete, observations").eq("mois", mois).maybeSingle();
  return { supabase, brouillon: data, erreur: null };
}

export async function enregistrerObservation(mois: string, salarieId: string, texte: string | null): Promise<ActionResult> {
  await requireAdmin();
  if (!moisValide(mois)) return { ok: false, erreur: "Mois invalide." };
  const { supabase, brouillon, erreur } = await brouillonModifiable(mois);
  if (erreur) return { ok: false, erreur };
  const observations = { ...((brouillon?.observations ?? {}) as Record<string, string>) };
  if (texte === null) delete observations[salarieId];
  else observations[salarieId] = texte;
  const { error } = await supabase
    .from("rh_etats_preparatoires")
    .upsert({ mois, date_arrete: brouillon?.date_arrete ?? null, observations, updated_at: new Date().toISOString() }, { onConflict: "mois" });
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/rh/etat");
  return { ok: true };
}

export async function changerDateArrete(mois: string, date: string | null): Promise<ActionResult> {
  await requireAdmin();
  if (!moisValide(mois)) return { ok: false, erreur: "Mois invalide." };
  if (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < `${mois}-01` || date > finDuMois(mois))) {
    return { ok: false, erreur: "La date d'arrêté doit être dans le mois." };
  }
  const { supabase, brouillon, erreur } = await brouillonModifiable(mois);
  if (erreur) return { ok: false, erreur };
  const { error } = await supabase
    .from("rh_etats_preparatoires")
    .upsert({ mois, date_arrete: date, observations: brouillon?.observations ?? {}, updated_at: new Date().toISOString() }, { onConflict: "mois" });
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/rh/etat");
  revalidatePath("/rh/pointage");
  return { ok: true };
}

export async function exporterEtat(mois: string, format: "xlsx" | "pdf"): Promise<string> {
  await requireAdmin();
  if (!moisValide(mois)) throw new Error("Mois invalide.");
  const supabase = await createClient();
  const etat = await chargerEtatPreparatoire(supabase, mois);
  const tampon = format === "xlsx" ? await classeurEtat(etat) : await pdfEtat(etat);
  return Buffer.from(tampon).toString("base64");
}

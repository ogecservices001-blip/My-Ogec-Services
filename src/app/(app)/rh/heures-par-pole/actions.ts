"use server";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { chargerLignesAnnee } from "@/lib/rh/lignes";
import { heuresParPole, ordrePoles, type HeuresPole } from "@/lib/rh/annuel";
import { libellePole, MOIS_COURTS } from "@/lib/rh/heures-pole-affichage";

const arrondi = (n: number) => Math.round(n * 100) / 100;

export async function exporterHeuresParPole(annee: number): Promise<string> {
  await requireAdmin();
  if (!Number.isInteger(annee)) throw new Error("Année invalide.");
  const supabase = await createClient();
  const donnees = heuresParPole(await chargerLignesAnnee(supabase, annee, new Date().toISOString().slice(0, 10)));
  const poles = ordrePoles(donnees.map((d) => d.pole));
  const somme = (f: (d: HeuresPole) => boolean) => arrondi(donnees.filter(f).reduce((t, d) => t + d.heures, 0)) || null;
  const salaries = [...new Map(donnees.map((d) => [d.profileId, d.salarie])).entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));

  const wb = new ExcelJS.Workbook();
  const parMois = wb.addWorksheet("Par pôle et par mois");
  parMois.addRow(["Pôle", ...MOIS_COURTS, "Total"]).font = { bold: true };
  for (const p of poles) parMois.addRow([libellePole(p), ...MOIS_COURTS.map((_, i) => somme((d) => d.pole === p && d.mois === i + 1)), somme((d) => d.pole === p)]);
  parMois.addRow(["Total", ...MOIS_COURTS.map((_, i) => somme((d) => d.mois === i + 1)), somme(() => true)]).font = { bold: true };
  parMois.getColumn(1).width = 34;

  const parSalarie = wb.addWorksheet("Par salarié");
  parSalarie.addRow(["Salarié", ...poles.map(libellePole), "Total"]).font = { bold: true };
  for (const [id, nom] of salaries) parSalarie.addRow([nom, ...poles.map((p) => somme((d) => d.profileId === id && d.pole === p)), somme((d) => d.profileId === id)]);
  parSalarie.addRow(["Total", ...poles.map((p) => somme((d) => d.pole === p)), somme(() => true)]).font = { bold: true };
  parSalarie.getColumn(1).width = 30;

  const detail = wb.addWorksheet("Salarié × pôle × mois");
  detail.addRow(["Salarié", "Pôle", ...MOIS_COURTS, "Total"]).font = { bold: true };
  for (const [id, nom] of salaries) {
    for (const p of poles) {
      const t = somme((d) => d.profileId === id && d.pole === p);
      if (t) detail.addRow([nom, libellePole(p), ...MOIS_COURTS.map((_, i) => somme((d) => d.profileId === id && d.pole === p && d.mois === i + 1)), t]);
    }
  }
  detail.getColumn(1).width = 30;
  detail.getColumn(2).width = 34;
  for (const ws of [parMois, parSalarie, detail]) ws.getRow(1).alignment = { wrapText: true, vertical: "middle" };
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
}

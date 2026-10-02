import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { COLONNES_SITES, ENTETES_SITES, NB_COLONNES_SITES } from "@/lib/repertoire/sites-excel";
import { finaliserFeuille } from "@/lib/excel-export";

/// Exporte les sites d'un seul client — même format que
/// /repertoire/clients/export, réimportable tel quel.
export async function GET(request: Request, { params }: { params: Promise<{ nom: string }> }) {
  await requireAdmin();
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);
  const horsContrat = new URL(request.url).searchParams.get("horsContrat") === "1";

  const supabase = await createClient();
  const { data: sites, error } = await supabase
    .from("sites")
    .select("*")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat)
    .order("site");
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("SITES");

  const entetes: string[] = [];
  for (let i = 0; i < NB_COLONNES_SITES; i++) entetes.push(ENTETES_SITES[i] ?? "");
  feuille.addRow(entetes);

  for (const site of sites ?? []) {
    const ligne: string[] = new Array(NB_COLONNES_SITES).fill("");
    for (const { index, champ } of COLONNES_SITES) {
      ligne[index] = String(site[champ as keyof typeof site] ?? "");
    }
    feuille.addRow(ligne);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = `${nomDecode}_sites.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

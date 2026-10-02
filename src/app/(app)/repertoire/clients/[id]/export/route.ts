import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { COLONNES_SITES, ENTETES_SITES, NB_COLONNES_SITES } from "@/lib/repertoire/sites-excel";
import { finaliserFeuille } from "@/lib/excel-export";

/// Exporte un seul site — même format que /repertoire/clients/export,
/// réimportable tel quel.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: site, error } = await supabase.from("sites").select("*").eq("id", id).single();
  if (error || !site) {
    return NextResponse.json({ erreur: error?.message ?? "Site introuvable." }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("SITES");

  const entetes: string[] = [];
  for (let i = 0; i < NB_COLONNES_SITES; i++) entetes.push(ENTETES_SITES[i] ?? "");
  feuille.addRow(entetes);

  const ligne: string[] = new Array(NB_COLONNES_SITES).fill("");
  for (const { index, champ } of COLONNES_SITES) {
    ligne[index] = String(site[champ as keyof typeof site] ?? "");
  }
  feuille.addRow(ligne);

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = `${site.nom}_${site.site}.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

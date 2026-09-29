import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { COLONNES_SITES, ENTETES_SITES, NB_COLONNES_SITES } from "@/lib/repertoire/sites-excel";

/// Exporte tous les sites au format de la feuille "SITES" du classeur
/// maître — réimportable tel quel via /repertoire/clients/importer.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: sites, error } = await supabase.from("sites").select("*").order("nom");
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

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="sites.xlsx"',
    },
  });
}

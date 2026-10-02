import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { COLONNES_SITES, ENTETES_SITES, NB_COLONNES_SITES } from "@/lib/repertoire/sites-excel";
import { finaliserFeuille } from "@/lib/excel-export";

/// Exporte les sites au format de la feuille "SITES" du classeur
/// maître — réimportable tel quel via /repertoire/clients/importer.
/// Filtré par ?horsContrat=0|1 si fourni (même périmètre que l'écran
/// "Clients sous contrat" / "Clients hors contrat" en cours).
export async function GET(request: Request) {
  await requireAdmin();

  const horsContratParam = new URL(request.url).searchParams.get("horsContrat");

  const supabase = await createClient();
  let requete = supabase.from("sites").select("*").order("nom");
  if (horsContratParam !== null) requete = requete.eq("hors_contrat", horsContratParam === "1");
  const { data: sites, error } = await requete;
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
  const nomFichier =
    horsContratParam === "1" ? "sites_hors_contrat.xlsx" : horsContratParam === "0" ? "sites_contrat.xlsx" : "sites.xlsx";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

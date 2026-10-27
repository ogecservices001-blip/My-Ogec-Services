import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import { labelPole } from "@/lib/bi/constants";
import { calculerLignesHeuresParPole, POLES_HEURES_PAR_POLE } from "../calcul";

export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const lignes = await calculerLignesHeuresParPole(supabase);

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Heures par pôle");
  feuille.addRow(["N°", "Client", "Site", ...POLES_HEURES_PAR_POLE.map((p) => labelPole(p)), "Total"]);
  for (const l of lignes) {
    feuille.addRow([
      l.numero,
      l.clientNom,
      l.clientSite,
      ...POLES_HEURES_PAR_POLE.map((p) => l.heuresParPole[p]),
      l.total,
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate("Heures_par_pole.xlsx")}"`,
    },
  });
}

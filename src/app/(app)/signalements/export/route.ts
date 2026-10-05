import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";

const LABEL_TYPE: Record<string, string> = { bug: "Bug", suggestion: "Suggestion", remarque: "Remarque" };

const ENTETES = ["Numéro", "Date", "Type", "Menu", "Sous-menu", "Nature", "Détail", "Auteur", "Traité"];

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: signalements, error } = await supabase
    .from("signalements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("SIGNALEMENTS");
  feuille.addRow(ENTETES);

  for (const s of signalements ?? []) {
    feuille.addRow([
      s.numero,
      new Date(s.created_at),
      LABEL_TYPE[s.type] ?? s.type,
      s.menu,
      s.sous_menu,
      s.nature,
      s.message,
      s.auteur_nom,
      s.traite ? "Oui" : "Non",
    ]);
  }

  feuille.getColumn(2).numFmt = "dd/mm/yyyy hh:mm";
  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="signalements.xlsx"',
    },
  });
}

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";

/// Exporte le référentiel actuel en classeur Excel, même format que
/// l'import — modifiable puis réimportable tel quel.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: references, error } = await supabase
    .from("references_horaires")
    .select("*")
    .order("designation");
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Base Horaire");

  feuille.addRow([
    "Type Equipement 1",
    "Type Equipement 2",
    "Type Equipement 3",
    "Désignation",
    "Hrs Tech An",
    "Hrs assistant An",
    "Hrs Tech Sem",
    "Hrs assistant Sem",
    "Hrs Tech Tri",
    "Hrs assistant Tri",
  ]);

  for (const r of references ?? []) {
    feuille.addRow([
      r.type_equipement1,
      r.type_equipement2,
      r.type_equipement3,
      r.designation,
      r.hrs_tech_an,
      r.hrs_assistant_an,
      r.hrs_tech_sem,
      r.hrs_assistant_sem,
      r.hrs_tech_tri,
      r.hrs_assistant_tri,
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Base_horaire_equipement.xlsx"',
    },
  });
}

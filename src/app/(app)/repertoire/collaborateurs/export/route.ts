import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { COLONNES_PROFILS, ENTETES_PROFILS, NB_COLONNES_PROFILS } from "@/lib/repertoire/profils-excel";
import { finaliserFeuille } from "@/lib/excel-export";

/// Exporte tous les collaborateurs — réimportable tel quel via
/// /repertoire/collaborateurs/importer. Le rôle n'est jamais exporté :
/// c'est une action manuelle distincte (gestion des accès/comptes).
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: profils, error } = await supabase.from("profiles").select("*").order("name");
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("COLLABORATEURS");

  const entetes: string[] = [];
  for (let i = 0; i < NB_COLONNES_PROFILS; i++) entetes.push(ENTETES_PROFILS[i] ?? "");
  feuille.addRow(entetes);

  for (const profil of profils ?? []) {
    const ligne: string[] = new Array(NB_COLONNES_PROFILS).fill("");
    for (const { index, champ } of COLONNES_PROFILS) {
      ligne[index] = String(profil[champ as keyof typeof profil] ?? "");
    }
    feuille.addRow(ligne);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="collaborateurs.xlsx"',
    },
  });
}

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";

const ENTETES = [
  "Nom",
  "Dénomination courte",
  "Interlocuteurs",
  "Tél",
  "Portable",
  "Courriel",
  "Site Web",
  "Commune",
  "Code Postal",
  "Adresse",
  "Complément Adresse",
  "Produits Clés",
  "Remarques",
];

/// Exporte tous les fournisseurs — réimportable tel quel via
/// /repertoire/fournisseurs/importer.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: fournisseurs, error } = await supabase
    .from("fournisseurs")
    .select("*")
    .order("nom");
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("FOURNISSEURS");
  feuille.addRow(ENTETES);

  for (const f of fournisseurs ?? []) {
    feuille.addRow([
      f.nom,
      f.denomination_courte,
      f.interlocuteurs,
      f.tel,
      f.portable,
      f.courriel,
      f.site_web,
      f.commune,
      f.code_postal,
      f.adresse,
      f.complement_adresse,
      f.produits_cles,
      f.remarques,
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="fournisseurs.xlsx"',
    },
  });
}

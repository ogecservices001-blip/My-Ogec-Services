import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import { TITRES_PU, type ArticlePU } from "@/lib/devis/referentiel-pu";

/// Même format que Réferentiel PU.xlsx : réimportable tel quel. Une
/// donnée purement numérique (puissance...) repart en nombre, comme
/// dans le fichier d'origine.
function valeurExport(v: string): string | number {
  const s = v.trim();
  return /^-?(0|[1-9]\d*)(\.\d*[1-9])?$/.test(s) ? Number(s.replace(",", ".")) : v;
}

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("referentiel_pu").select("*").order("ordre").order("created_at");
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Référentiel PU");
  feuille.addRow(TITRES_PU.map((t) => t.titre));
  feuille.getRow(1).font = { bold: true };

  for (const a of (data ?? []) as ArticlePU[]) {
    feuille.addRow(
      TITRES_PU.map((t) => {
        const v = a[t.cle];
        if (t.cle === "tarif_net_ht" || t.cle === "mo_heures") return v === null ? null : Number(v);
        if (t.cle === "date_maj_tarif") return v ? new Date(`${String(v).slice(0, 10)}T00:00:00Z`) : null;
        return valeurExport(String(v ?? ""));
      }),
    );
  }
  feuille.getColumn(TITRES_PU.findIndex((t) => t.cle === "tarif_net_ht") + 1).numFmt = "#,##0.00";
  feuille.getColumn(TITRES_PU.findIndex((t) => t.cle === "date_maj_tarif") + 1).numFmt = "dd/mm/yyyy";

  finaliserFeuille(feuille);
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate("Referentiel_PU.xlsx")}"`,
    },
  });
}

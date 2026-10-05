import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement } from "@/lib/gmao/types";
import { COLONNES_SOMMAIRE, ligneSommaire } from "@/lib/gmao/equipement-export";
import { finaliserFeuille } from "@/lib/excel-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: site, error: errSite }, { data: equipements, error }, { data: types }] = await Promise.all([
    supabase.from("sites").select("nom, site, n_affaire").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("site_id", id).order("nom"),
    supabase.from("types_equipement").select("*"),
  ]);
  if (errSite || !site) return NextResponse.json({ erreur: "Site introuvable." }, { status: 404 });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Sommaire");
  feuille.addRow(COLONNES_SOMMAIRE);
  for (const eq of (equipements ?? []) as Equipement[]) {
    feuille.addRow(ligneSommaire(eq, site, typesById));
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = `${site.nom}_${site.site}_equipements.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

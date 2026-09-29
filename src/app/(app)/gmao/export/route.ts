import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement } from "@/lib/gmao/types";
import { COLONNES_SOMMAIRE, ligneSommaire } from "@/lib/gmao/equipement-export";

/// Exporte le parc GMAO entier, tous clients confondus — port de
/// `GmaoHomeScreen._exporterTout`.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: sites, error: errSites }, { data: equipements, error }, { data: types }] = await Promise.all([
    supabase.from("sites").select("id, nom, site"),
    supabase.from("equipements").select("*").order("nom"),
    supabase.from("types_equipement").select("*"),
  ]);
  if (errSites) return NextResponse.json({ erreur: errSites.message }, { status: 500 });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const sitesById: Record<string, { nom: string; site: string }> = {};
  for (const s of sites ?? []) sitesById[s.id] = { nom: s.nom, site: s.site };
  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Sommaire");
  feuille.addRow(COLONNES_SOMMAIRE);
  for (const eq of (equipements ?? []) as Equipement[]) {
    const site = sitesById[eq.site_id];
    if (!site) continue;
    feuille.addRow(ligneSommaire(eq, site, typesById));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="GMAO_tous_clients_equipements.xlsx"',
    },
  });
}

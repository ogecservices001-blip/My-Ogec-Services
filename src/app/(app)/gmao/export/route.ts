import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement } from "@/lib/gmao/types";
import { COLONNES_SOMMAIRE, ligneSommaire } from "@/lib/gmao/equipement-export";
import { finaliserFeuille } from "@/lib/excel-export";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";

/// Exporte le parc GMAO entier, tous clients confondus — port de
/// `GmaoHomeScreen._exporterTout`.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: sites, error: errSites }, { data: types }] = await Promise.all([
    supabase.from("sites").select("id, nom, site, n_affaire"),
    supabase.from("types_equipement").select("*"),
  ]);
  if (errSites) return NextResponse.json({ erreur: errSites.message }, { status: 500 });

  let equipements: Equipement[];
  try {
    equipements = await recupererToutesLesLignes<Equipement>((debut, fin) =>
      supabase.from("equipements").select("*").order("nom").range(debut, fin),
    );
  } catch (e) {
    return NextResponse.json({ erreur: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const sitesById: Record<string, { nom: string; site: string; n_affaire: string }> = {};
  for (const s of sites ?? []) sitesById[s.id] = { nom: s.nom, site: s.site, n_affaire: s.n_affaire };
  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Sommaire");
  feuille.addRow(COLONNES_SOMMAIRE);
  for (const eq of equipements) {
    const site = sitesById[eq.site_id];
    if (!site) continue;
    feuille.addRow(ligneSommaire(eq, site, typesById));
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="GMAO_tous_clients_equipements.xlsx"',
    },
  });
}

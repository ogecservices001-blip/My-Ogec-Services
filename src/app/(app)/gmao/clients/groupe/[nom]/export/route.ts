import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement } from "@/lib/gmao/types";
import { COLONNES_SOMMAIRE, ligneSommaire } from "@/lib/gmao/equipement-export";
import { finaliserFeuille } from "@/lib/excel-export";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";

/// Exporte tous les équipements de tous les sites d'un client — port de
/// `GmaoClientsScreen._exporterTousLesSites`.
export async function GET(_request: Request, { params }: { params: Promise<{ nom: string }> }) {
  await requireAdmin();
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);

  const supabase = await createClient();
  const { data: sites, error: errSites } = await supabase.from("sites").select("id, nom, site").eq("nom", nomDecode);
  if (errSites) return NextResponse.json({ erreur: errSites.message }, { status: 500 });
  const siteIds = (sites ?? []).map((s) => s.id);
  if (siteIds.length === 0) return NextResponse.json({ erreur: "Client introuvable." }, { status: 404 });

  const [equipements, { data: types }] = await Promise.all([
    recupererToutesLesLignes<Equipement>((debut, fin) =>
      supabase.from("equipements").select("*").in("site_id", siteIds).order("nom").range(debut, fin),
    ),
    supabase.from("types_equipement").select("*"),
  ]);

  const sitesById: Record<string, { nom: string; site: string }> = {};
  for (const s of sites ?? []) sitesById[s.id] = { nom: s.nom, site: s.site };
  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Sommaire");
  feuille.addRow(COLONNES_SOMMAIRE);
  for (const eq of equipements) {
    const site = sitesById[eq.site_id];
    if (site) feuille.addRow(ligneSommaire(eq, site, typesById));
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = `${nomDecode}_tous_sites_equipements.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

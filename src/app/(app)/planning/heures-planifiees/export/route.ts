import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import { calculerHeuresPlanifiees } from "@/lib/planning/heures-planifiees";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const client = params.get("client") ?? "";
  const site = params.get("site") ?? "";
  const annee = Number(params.get("annee")) || new Date().getFullYear();

  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites_view").select("id, nom");
  const siteIds = site ? [site] : client ? (sites ?? []).filter((s) => s.nom === client).map((s) => s.id) : [];
  const { lignes, totaux, heuresContrat } = await calculerHeuresPlanifiees(supabase, siteIds, annee);

  const fr = (d: string) => d.split("-").reverse().join("/");
  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet(`Heures ${annee}`);
  feuille.addRow(["Type", "Début", "Fin", "Site", "Détail", "Techniciens", "Heures prévues", "Heures réalisées", "État"]);
  for (const l of lignes) {
    feuille.addRow([l.libelleType, fr(l.debut), fr(l.fin), l.site, l.detail, l.techniciens.join(", "), l.heuresPrevues ?? "", l.heuresRealisees ?? "", l.etat]);
  }

  const synthese = workbook.addWorksheet("Totaux");
  synthese.addRow(["Type", "Nombre", "Heures prévues", "Heures réalisées"]);
  synthese.addRow(["Visites d'entretien", totaux.entretien.nombre, totaux.entretien.prevues, totaux.entretien.realisees]);
  synthese.addRow(["Travaux sur devis", totaux.devis.nombre, totaux.devis.prevues, totaux.devis.realisees]);
  synthese.addRow(["Dépannages", totaux.depannage.nombre, totaux.depannage.prevues, totaux.depannage.realisees]);
  synthese.addRow(["Autres BI", totaux.autre.nombre, totaux.autre.prevues, totaux.autre.realisees]);
  synthese.addRow([]);
  synthese.addRow(["Heures vendues au contrat (par an)", "", heuresContrat, ""]);

  for (const f of [feuille, synthese]) finaliserFeuille(f);
  const nom = (site ? "Site" : client || "Heures").replace(/[^\w-]+/g, "_");
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate(`Heures_planifiees_${nom}_${annee}.xlsx`)}"`,
    },
  });
}

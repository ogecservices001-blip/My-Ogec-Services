import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import { calculerHeuresPlanifiees, FILTRES_POLE, lireFiltrePole, typesDuFiltre } from "@/lib/planning/heures-planifiees";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const client = params.get("client") ?? "";
  const site = params.get("site") ?? "";
  const annee = Number(params.get("annee")) || new Date().getFullYear();
  const pole = lireFiltrePole(params.get("pole"));
  const types = typesDuFiltre(pole);

  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites_view").select("id, nom");
  const siteIds = site ? [site] : client ? (sites ?? []).filter((s) => s.nom === client).map((s) => s.id) : null;
  const { lignes, totaux, heuresContrat } = await calculerHeuresPlanifiees(supabase, siteIds, annee);

  const fr = (d: string) => d.split("-").reverse().join("/");
  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet(`Heures ${annee}`);
  feuille.addRow(["Type", "Début", "Fin", "Client", "Site", "Détail", "Techniciens", "Heures prévues", "Heures réalisées", "État"]);
  for (const l of lignes.filter((x) => types.includes(x.type))) {
    feuille.addRow([l.libelleType, fr(l.debut), fr(l.fin), l.client, l.site, l.detail, l.techniciens.join(", "), l.heuresPrevues ?? "", l.heuresRealisees ?? "", l.etat]);
  }

  const synthese = workbook.addWorksheet("Totaux");
  synthese.addRow(["Type", "Nombre", "Heures prévues", "Heures réalisées"]);
  const libelles = { entretien: "Visites d'entretien", devis: "Travaux sur devis", depannage: "Dépannages", autre: "Autres BI" } as const;
  for (const t of types) synthese.addRow([libelles[t], totaux[t].nombre, totaux[t].prevues, totaux[t].realisees]);
  synthese.addRow([]);
  if (types.includes("entretien")) synthese.addRow(["Heures vendues au contrat (par an)", "", heuresContrat, ""]);
  synthese.addRow(["Filtre", FILTRES_POLE.find((f) => f.valeur === pole)?.libelle ?? ""]);

  for (const f of [feuille, synthese]) finaliserFeuille(f);
  const nom = (site ? "Site" : client || "Tout_le_parc").replace(/[^\w-]+/g, "_");
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate(`Heures_planifiees_${nom}_${annee}.xlsx`)}"`,
    },
  });
}

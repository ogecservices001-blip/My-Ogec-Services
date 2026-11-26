import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import { chargerDeclarationAnnuelle, chargerParcCerfa, classerParc, type EquipementParc } from "../../donnees-parc";

const ENTETES = ["Client", "Site", "N° affaire", "N° équipement", "Équipement", "Fluide", "Charge (kg)", "Dernier contrôle", "Prochain contrôle"];

function feuilleEquipements(wb: ExcelJS.Workbook, nom: string, liste: EquipementParc[]) {
  const f = wb.addWorksheet(nom);
  f.addRow(ENTETES);
  for (const e of liste) {
    f.addRow([e.client, e.site, e.nAffaire, e.numero, e.nom, e.fluide, e.charge, e.dernierControle, e.prochainControle || "Jamais contrôlé"]);
  }
  finaliserFeuille(f);
}

/// Export du Point sur les CERFA : une feuille par rubrique, plus la
/// déclaration annuelle des quantités de fluide.
export async function GET(req: Request) {
  await requireAdmin();
  const anneeDemandee = Number(new URL(req.url).searchParams.get("annee"));
  const annee = Number.isInteger(anneeDemandee) && anneeDemandee > 2000 ? anneeDemandee : new Date().getFullYear();
  const [parc, declaration] = await Promise.all([chargerParcCerfa(), chargerDeclarationAnnuelle(annee)]);
  const c = classerParc(parc);

  const wb = new ExcelJS.Workbook();
  const synthese = wb.addWorksheet("Synthèse");
  synthese.addRow(["Point sur les CERFA", new Date().toLocaleDateString("fr-FR")]);
  synthese.addRow([]);
  synthese.addRow(["Équipements à fluide", parc.length]);
  synthese.addRow(["Soumis (charge > 2 kg)", c.soumis.length]);
  synthese.addRow(["À jour", c.aJour.length]);
  synthese.addRow(["En retard / à faire", c.enRetard.length]);
  synthese.addRow(["Dans le mois à venir", c.dansLeMois.length]);
  synthese.addRow(["Charge à relever", c.chargeARelever.length]);
  synthese.getRow(1).font = { bold: true, size: 13 };
  synthese.getColumn(1).width = 34;
  synthese.getColumn(2).width = 14;

  feuilleEquipements(wb, "En retard - à faire", c.enRetard);
  feuilleEquipements(wb, "Dans le mois", c.dansLeMois);
  feuilleEquipements(wb, "À jour", c.aJour);
  feuilleEquipements(wb, "Charge à relever", c.chargeARelever);

  const d = wb.addWorksheet(`Déclaration ${annee}`);
  d.addRow(["Fluide", "Nb CERFA", "Chargé - équipements neufs (kg)", "Chargé - maintenance (kg)", "Récupéré - maintenance (kg)", "Récupéré - hors d'usage (kg)"]);
  for (const l of declaration) d.addRow([l.fluide, l.nbCerfa, l.chargeesNeufs, l.chargeesMaintenance, l.recupMaintenance, l.recupHorsUsage]);
  const t = declaration.reduce(
    (s, l) => [s[0] + l.nbCerfa, s[1] + l.chargeesNeufs, s[2] + l.chargeesMaintenance, s[3] + l.recupMaintenance, s[4] + l.recupHorsUsage],
    [0, 0, 0, 0, 0],
  );
  const ligneTotal = d.addRow(["Total", ...t]);
  ligneTotal.font = { bold: true };
  finaliserFeuille(d);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate("point_cerfa.xlsx")}"`,
    },
  });
}

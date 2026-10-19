import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import { calculerLignesAuditHeures } from "../calcul";

const COLONNES = [
  "N°",
  "Client",
  "Site",
  "À programmer - Tech",
  "À programmer - Assistant",
  "Programmées (planning)",
  "Déjà réalisées - Tech",
  "Déjà réalisées - Assistant",
  "Total dû au contrat - Tech",
  "Total dû au contrat - Assistant",
  "Heure exécution - Tech",
  "Heure exécution - Assistant",
];

export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const lignes = await calculerLignesAuditHeures(supabase);

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Audit Heures");
  feuille.addRow(COLONNES);
  for (const l of lignes) {
    feuille.addRow([
      l.numero,
      l.clientNom,
      l.clientSite,
      l.progTech,
      l.progAssistant,
      l.programmeesTech,
      l.realTech,
      l.realAssistant,
      l.contratTech,
      l.contratAssistant,
      l.executionTech,
      l.executionAssistant,
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate("Audit_heures_clients_sous_contrat.xlsx")}"`,
    },
  });
}

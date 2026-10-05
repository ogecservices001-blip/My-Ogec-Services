import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Statuts } from "@/lib/bi/constants";
import { labelNatureDevis } from "@/lib/devis/constants";
import { finaliserFeuille } from "@/lib/excel-export";

const STATUTS_REALISE = new Set<string>(Object.values(Statuts).filter((s) => s !== Statuts.brouillon));

const ENTETES = [
  "N° Devis",
  "Client",
  "Site",
  "Nature",
  "Libellé",
  "Montant",
  "Heures prévues",
  "Date commande client",
  "N° BI",
  "Statut",
];

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: devis, error }, { data: bons }, { data: sites }] = await Promise.all([
    supabase.from("devis").select("*").neq("date_commande_client", ""),
    supabase.from("bons_intervention").select("id, devis_id, numero, statut"),
    supabase.from("sites").select("id, nom, site"),
  ]);
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const bonParDevisId = new Map<string, { numero: string; statut: string }>();
  for (const b of bons ?? []) {
    if (!b.devis_id) continue;
    const existant = bonParDevisId.get(b.devis_id);
    if (!existant || (STATUTS_REALISE.has(b.statut) && !STATUTS_REALISE.has(existant.statut))) {
      bonParDevisId.set(b.devis_id, { numero: b.numero, statut: b.statut });
    }
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("PRESTATIONS");
  feuille.addRow(ENTETES);

  for (const d of devis ?? []) {
    const site = siteParId.get(d.site_id);
    const bon = bonParDevisId.get(d.id);
    const realisee = (bon ? STATUTS_REALISE.has(bon.statut) : false) || Boolean(d.bi_reference_historique);
    const statut = d.annule ? "Annulée" : realisee ? "Réalisée" : "À réaliser";
    feuille.addRow([
      d.numero,
      site?.nom ?? "",
      site?.site ?? "",
      labelNatureDevis(d.nature),
      d.libelle,
      d.montant,
      d.heures_prevues,
      d.date_commande_client,
      bon?.numero ?? d.bi_reference_historique ?? "",
      statut,
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="prestations_sur_commande.xlsx"',
    },
  });
}

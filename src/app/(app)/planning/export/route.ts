import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";
import { ENTETES_PLANNING, cleCreneau } from "@/lib/planning/export-import";

export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: creneaux, error } = await supabase
    .from("creneaux_planning")
    .select(
      "site_id, devis_id, poste_hors_client_id, client_nom, site, date, heures_prevues, devis:devis_id(numero), poste:poste_hors_client_id(numero_legacy), creneau_techniciens(profiles(name))",
    )
    .eq("annule", false)
    .order("date");
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  // Regroupe par (date, affaire) — même fusion que l'ancienne feuille
  // "Date inter Prog Client" : plusieurs techniciens sur la même
  // affaire le même jour deviennent une seule ligne, heures cumulées.
  const groupes = new Map<
    string,
    { client: string; site: string; numeroAffaire: string; date: string; heures: number; intervenants: Set<string> }
  >();

  for (const c of creneaux ?? []) {
    const devis = Array.isArray(c.devis) ? c.devis[0] : c.devis;
    const poste = Array.isArray(c.poste) ? c.poste[0] : c.poste;
    const numeroAffaire = c.poste_hors_client_id ? (poste?.numero_legacy ?? "") : (c.devis_id ? devis?.numero : undefined) || c.site;
    const cle = cleCreneau({ date: c.date, siteId: c.site_id, devisId: c.devis_id, posteHorsClientId: c.poste_hors_client_id });

    if (!groupes.has(cle)) {
      groupes.set(cle, {
        client: c.client_nom,
        site: c.site,
        numeroAffaire: numeroAffaire ?? "",
        date: c.date,
        heures: 0,
        intervenants: new Set(),
      });
    }
    const g = groupes.get(cle)!;
    g.heures += Number(c.heures_prevues);
    for (const ct of c.creneau_techniciens ?? []) {
      const profils = Array.isArray(ct.profiles) ? ct.profiles : ct.profiles ? [ct.profiles] : [];
      for (const p of profils) g.intervenants.add(p.name);
    }
  }

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Date inter Prog Client");
  feuille.addRow(ENTETES_PLANNING);

  for (const g of [...groupes.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const d = new Date(`${g.date}T00:00:00Z`);
    const intervenants = [...g.intervenants];
    const ligne = feuille.addRow([
      g.client,
      g.site,
      g.numeroAffaire,
      d,
      d.getUTCMonth() + 1,
      Math.ceil((d.getTime() - new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime()) / (7 * 86400000)) + 1,
      g.heures,
      intervenants[0] ?? "",
      intervenants[1] ?? "",
      intervenants[2] ?? "",
      intervenants[3] ?? "",
    ]);
    ligne.getCell(4).numFmt = "dd/mm/yyyy";
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="date_inter_prog_client.xlsx"',
    },
  });
}

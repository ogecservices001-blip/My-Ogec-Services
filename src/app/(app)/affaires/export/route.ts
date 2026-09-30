import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { labelNatureAffaire } from "@/lib/affaires/constants";

const COLONNES = [
  "Numéro de devis",
  "Client",
  "Site",
  "Désignation des prestations",
  "Email responsable contrat",
  "Date de commande client",
  "Référence commande client",
  "Nature",
];

/// Export global (toutes les affaires) ou filtré sur un client via
/// ?nom=... — même 8 colonnes que AffaireExportService côté Flutter.
export async function GET(request: Request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const nom = searchParams.get("nom");

  const supabase = await createClient();
  const { data: sites, error: errSites } = await supabase.from("sites").select("id, nom, site");
  if (errSites) return NextResponse.json({ erreur: errSites.message }, { status: 500 });

  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const siteIds = nom ? (sites ?? []).filter((s) => s.nom === nom).map((s) => s.id) : null;

  let requete = supabase.from("affaires").select("*").order("created_at", { ascending: false });
  if (siteIds) requete = requete.in("site_id", siteIds);
  const { data: affaires, error } = await requete;
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("AFFAIRES");
  feuille.addRow(COLONNES);

  for (const a of affaires ?? []) {
    const site = siteParId.get(a.site_id);
    feuille.addRow([
      a.numero_devis,
      site?.nom ?? "",
      site?.site ?? "",
      a.designation_prestations,
      a.email_responsable_contrat,
      a.date_commande_client,
      a.numero_commande_client,
      a.nature ? labelNatureAffaire(a.nature) : "",
    ]);
  }

  feuille.columns.forEach((col) => (col.width = 22));

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = nom ? `${nom.replace(/[^a-zA-Z0-9._-]/g, "_")}_affaires.xlsx` : "toutes_les_affaires.xlsx";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

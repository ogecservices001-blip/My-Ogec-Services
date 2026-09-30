import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { labelNatureDevis } from "@/lib/devis/constants";

const COLONNES = [
  "Référence devis",
  "Client",
  "Site",
  "Item",
  "Rédacteur",
  "Nature",
  "Date devis",
  "Libellé",
  "Montant",
  "Date commande client",
  "Référence client",
  "Statut commande fournisseur",
  "Date mise à disposition fourniture",
  "Réf. BI historique",
  "Mois facturation",
  "Remarques",
  "Débours matériel prévu",
  "Heures prévues",
  "Annulé",
];

export async function GET(request: Request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const nom = searchParams.get("nom");

  const supabase = await createClient();
  const { data: sites, error: errSites } = await supabase.from("sites").select("id, nom, site");
  if (errSites) return NextResponse.json({ erreur: errSites.message }, { status: 500 });

  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const siteIds = nom ? (sites ?? []).filter((s) => s.nom === nom).map((s) => s.id) : null;

  let requete = supabase.from("devis").select("*").order("created_at", { ascending: false });
  if (siteIds) requete = requete.in("site_id", siteIds);
  const { data: devis, error } = await requete;
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Devis");
  feuille.addRow(COLONNES);

  for (const d of devis ?? []) {
    const site = siteParId.get(d.site_id);
    feuille.addRow([
      d.numero,
      site?.nom ?? "",
      site?.site ?? "",
      d.item,
      d.redacteur,
      d.nature ? labelNatureDevis(d.nature) : "",
      d.date_devis,
      d.libelle,
      d.montant,
      d.date_commande_client,
      d.reference_client,
      d.statut_commande_fournisseur,
      d.date_mise_a_disposition_fourniture,
      d.bi_reference_historique,
      d.mois_facturation,
      d.remarques,
      d.debours_materiel_prevu,
      d.heures_prevues,
      d.annule ? "Oui" : "",
    ]);
  }

  feuille.columns.forEach((col) => (col.width = 20));

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = nom ? `${nom.replace(/[^a-zA-Z0-9._-]/g, "_")}_devis.xlsx` : "tous_les_devis.xlsx";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

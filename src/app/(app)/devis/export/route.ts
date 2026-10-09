import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { labelNatureDevis } from "@/lib/devis/constants";
import { finaliserFeuille } from "@/lib/excel-export";
import { STATUTS_BI_REALISE, calculerStatutDevis, LABEL_STATUT_DEVIS } from "../statut";

const COLONNES = [
  "Référence devis",
  "Client",
  "Site",
  "Équipement concerné",
  "Localisation",
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
  "Statut",
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

  const idsEquipements = [...new Set((devis ?? []).map((d) => d.equipement_id).filter((id): id is string => Boolean(id)))];
  const [{ data: equipements, error: errEquipements }, { data: bons, error: errBons }] = await Promise.all([
    idsEquipements.length
      ? supabase.from("equipements").select("id, nom, numero_equipement, localisation").in("id", idsEquipements)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("bons_intervention").select("devis_id, statut"),
  ]);
  if (errEquipements) return NextResponse.json({ erreur: errEquipements.message }, { status: 500 });
  if (errBons) return NextResponse.json({ erreur: errBons.message }, { status: 500 });
  const equipementParId = new Map((equipements ?? []).map((e) => [e.id, e]));
  const devisRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id as string),
  );

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Devis");
  feuille.addRow(COLONNES);

  for (const d of devis ?? []) {
    const site = siteParId.get(d.site_id);
    const equipement = d.equipement_id ? equipementParId.get(d.equipement_id) : undefined;
    const statut = calculerStatutDevis({
      annule: d.annule,
      commande: Boolean(d.date_commande_client),
      realise: devisRealises.has(d.id) || Boolean(d.bi_reference_historique),
      facturable: Boolean(d.mois_facturation),
    });
    feuille.addRow([
      d.numero,
      site?.nom ?? "",
      site?.site ?? "",
      equipement
        ? [equipement.nom, equipement.numero_equipement ? `(${equipement.numero_equipement})` : ""]
            .filter(Boolean)
            .join(" ")
        : "",
      equipement?.localisation ?? "",
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
      LABEL_STATUT_DEVIS[statut],
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = nom ? `${nom.replace(/[^a-zA-Z0-9._-]/g, "_")}_devis.xlsx` : "tous_les_devis.xlsx";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

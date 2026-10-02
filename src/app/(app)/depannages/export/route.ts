import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";

/// Colonnes de la feuille "Chrono Dépannage" du classeur
/// "Suivi dépannage.xlsm" — même ordre, même architecture (21
/// colonnes), pour rester compatible avec les macros/récaps déjà en
/// place. "N° Bon intervention" et "Commentaires technicien" viennent
/// du BI créé depuis ce ticket (voir demandes_depannage.bon_intervention_id,
/// posé par l'assistant BI au pôle Dépannage) — vides tant qu'aucun
/// bon n'y est encore rattaché.
const COLONNES = [
  "N° Intervention",
  "N°affaire",
  "Clients",
  "Sites",
  "Date Demande",
  "Motif de l'appel",
  "Lieu de la panne",
  "N° Demande Client",
  "Intervenant",
  "Date intervention prévue",
  "N° Bon intervention",
  "Commentaires technicien",
  "Code Postal",
  "Commune",
  "Adresse",
  "Interlocuteur Sur site",
  "N° tel 1 client",
  "N° tel 2 client",
  "Couriel",
  "N° semaine",
];

/// Numéro de semaine ISO 8601 (lundi = premier jour, la semaine 1 est
/// celle qui contient le premier jeudi de l'année) — équivalent de
/// `DatePart("ww", date, vbMonday, vbFirstFourDays)` côté VBA.
function numeroSemaineIso(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jour = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const jourPremierJeudi = (premierJeudi.getUTCDay() + 6) % 7;
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - jourPremierJeudi + 3);
  return 1 + Math.round((d.getTime() - premierJeudi.getTime()) / (7 * 24 * 3600 * 1000));
}

export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: demandes, error }, { data: sites }, { data: profils }] = await Promise.all([
    supabase.from("demandes_depannage").select("*").order("date_creation", { ascending: false }),
    supabase
      .from("sites")
      .select(
        "id, n_affaire, code_postal, commune, adresse, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site",
      ),
    supabase.from("profiles").select("id, name, portable"),
  ]);
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const idsBI = (demandes ?? []).map((d) => d.bon_intervention_id).filter((id): id is string => Boolean(id));
  const { data: bons } = idsBI.length
    ? await supabase.from("bons_intervention").select("id, numero, compte_rendu").in("id", idsBI)
    : { data: [] };
  const bonsParId: Record<string, { numero: string; compte_rendu: string }> = {};
  for (const b of bons ?? []) bonsParId[b.id] = { numero: b.numero, compte_rendu: b.compte_rendu };

  const sitesParId: Record<
    string,
    {
      n_affaire: string;
      code_postal: string;
      commune: string;
      adresse: string;
      interlocuteur_site: string;
      tel_fixe_interlocuteur_site: string;
      portable_interlocuteur_site: string;
    }
  > = {};
  for (const s of sites ?? []) sitesParId[s.id] = s;

  const profilsParId: Record<string, { name: string; portable: string }> = {};
  for (const p of profils ?? []) profilsParId[p.id] = { name: p.name, portable: p.portable };

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Chrono Dépannage");
  feuille.addRow(COLONNES);

  for (const d of demandes ?? []) {
    const site = d.site_id ? sitesParId[d.site_id] : undefined;
    const intervenant = d.intervenant_id ? profilsParId[d.intervenant_id] : undefined;
    const intervenantTexte = intervenant
      ? [intervenant.name, intervenant.portable].filter(Boolean).join(" - ")
      : "";
    const dateCreation = new Date(d.date_creation);
    const bon = d.bon_intervention_id ? bonsParId[d.bon_intervention_id] : undefined;

    feuille.addRow([
      d.numero,
      site?.n_affaire ?? "",
      d.client_nom,
      d.client_site,
      dateCreation,
      d.message,
      d.lieu_panne,
      d.numero_demande_client,
      intervenantTexte,
      d.date_intervention_prevue ? new Date(`${d.date_intervention_prevue}T00:00:00`) : "",
      bon?.numero ?? "",
      bon?.compte_rendu ?? "",
      site?.code_postal ?? "",
      site?.commune ?? "",
      site?.adresse ?? "",
      site?.interlocuteur_site ?? "",
      site?.tel_fixe_interlocuteur_site ?? "",
      site?.portable_interlocuteur_site ?? "",
      d.email,
      numeroSemaineIso(dateCreation),
    ]);
  }

  feuille.getColumn(5).numFmt = "dd/mm/yyyy";
  feuille.getColumn(10).numFmt = "dd/mm/yyyy";
  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Chrono_Depannage.xlsx"',
    },
  });
}

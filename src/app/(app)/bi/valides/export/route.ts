import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";
import { labelPole, labelStatut, Statuts } from "@/lib/bi/constants";
import {
  dureeEnHeures,
  parsePu,
  totalHT,
  eur,
  interventionsDuBon,
  prestaSummary,
  type Presta,
} from "@/lib/bi/format";

const STATUTS_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

const LABEL_CLASSEMENT: Record<string, string> = {
  "": "À classer",
  archiver: "Archivage chantier",
  facturer: "À facturer",
};

const ENTETES = [
  "N°",
  "Pôle",
  "Statut",
  "Classement",
  "Mois facturation",
  "Client",
  "Site",
  "Adresse",
  "Hors contrat",
  "Équipement",
  "Groupe équipement",
  "Localisation équipement",
  "N° Affaire (devis)",
  "Réf. commande client",
  "Date commande client",
  "Techniciens",
  "Technicien signataire",
  "Date intervention",
  "Heure début",
  "Heure fin",
  "Date début (période)",
  "Date fin (période)",
  "Temps passé",
  "Nombre déplacements",
  "Groupes entretenus",
  "Compte rendu",
  "Prestations / fournitures",
  "Taux horaire régie",
  "Forfait déplacement",
  "Montant HT estimé",
  "Observations technicien",
  "Observations client",
  "Note interne",
  "Signataire",
  "Tél signataire",
  "Email client",
  "Date signature",
  "Créé le",
  "Mis à jour le",
];

export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: bons, error } = await supabase
    .from("bons_intervention")
    .select("*")
    .in("statut", STATUTS_VALIDES)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const siteIds = [...new Set((bons ?? []).map((b) => b.site_id).filter((id): id is string => Boolean(id)))];
  const { data: sites } =
    siteIds.length > 0
      ? await supabase.from("sites").select("id, taux_horaire_regie, forfait_deplacement").in("id", siteIds)
      : { data: [] };
  const tauxParSite = new Map((sites ?? []).map((s) => [s.id, s]));

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Bons validés");
  feuille.addRow(ENTETES);

  for (const b of bons ?? []) {
    const taux = b.site_id ? tauxParSite.get(b.site_id) : undefined;
    const heures = dureeEnHeures(b.temps_passe);
    const tauxRegie = parsePu(taux?.taux_horaire_regie ?? "");
    const montantHeures = heures !== null && tauxRegie !== null ? heures * tauxRegie : 0;
    const forfait = parsePu(taux?.forfait_deplacement ?? "");
    const montantDeplacements = forfait !== null ? forfait * b.nombre_deplacements : 0;
    const interventions = interventionsDuBon(b);
    const prestas: Presta[] = interventions.flatMap((i) => i.prestas);
    const montantTotal = montantHeures + montantDeplacements + totalHT(prestas);
    const compteRendu = interventions.map((i) => i.compte_rendu).filter(Boolean).join(" | ");
    const prestasTexte = prestas.length > 0 ? prestaSummary(prestas) : "";

    feuille.addRow([
      b.numero || "(brouillon)",
      `${b.pole} · ${labelPole(b.pole)}`,
      labelStatut(b.statut),
      LABEL_CLASSEMENT[b.classement] ?? b.classement,
      b.mois_facturation,
      b.client_nom,
      b.site,
      b.adresse,
      b.hors_contrat ? "Oui" : "Non",
      b.equipement_nom,
      b.equipement_groupe,
      b.equipement_localisation,
      b.devis_numero,
      b.devis_reference_client,
      b.devis_date_commande_client,
      b.techniciens.join(", "),
      b.technicien_signataire,
      b.date_intervention,
      b.heure_debut,
      b.heure_fin,
      b.date_debut,
      b.date_fin,
      b.temps_passe,
      b.nombre_deplacements,
      b.entretien_groupes.join(", "),
      compteRendu,
      prestasTexte,
      taux?.taux_horaire_regie ?? "",
      taux?.forfait_deplacement ?? "",
      eur(montantTotal),
      b.obs_tech,
      b.obs_client,
      b.note_interne,
      b.signataire,
      b.signataire_tel_fixe || b.signataire_tel_portable,
      b.email,
      b.date_signature,
      new Date(b.created_at).toLocaleDateString("fr-FR"),
      new Date(b.updated_at).toLocaleDateString("fr-FR"),
    ]);
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="bons_intervention_valides.xlsx"',
    },
  });
}

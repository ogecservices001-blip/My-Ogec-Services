import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement } from "@/lib/gmao/types";

/// Colonnes du format "Sommaire", dans l'ordre — pour que le fichier
/// exporté puisse être édité puis réimporté tel quel (import-actions.ts).
/// Port de `_colonnesSommaire` (equipement_export_service.dart).
const COLONNES = [
  "Nom Equipements",
  "Fréquence entretien annuelle",
  "Fréquence courante",
  "Type de Relevé",
  "Groupe",
  "Client",
  "Site",
  "Numéro Client",
  "Numéro Site",
  "Numéro Équipement",
  "Type Equipement 1",
  "Type Equipement 2",
  "Type Equipement 3",
  "Marque",
  "Date M.E.S.",
  "Référence unité intérieure",
  "Référence unité extérieure",
  "Numéro Série unité intérieure",
  "Numéro Série unité extérieure",
  "Localisation",
  "Date Interv prévue",
  "Nom Tech",
  "Réfrigérant",
  "Charge Réfrigérant Kg",
  "Tension Alim.",
  "Puissance",
];

function cellNumerique(valeur: unknown): number | string {
  const texte = valeur?.toString() ?? "";
  const nombre = Number(texte.replace(",", "."));
  return texte && Number.isFinite(nombre) ? nombre : "";
}

function champ(c: Record<string, unknown>, cle: string): string {
  const v = c[cle];
  return typeof v === "string" ? v : "";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: site, error: errSite }, { data: equipements, error }, { data: types }] = await Promise.all([
    supabase.from("sites").select("nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("site_id", id).order("nom"),
    supabase.from("types_equipement").select("*"),
  ]);
  if (errSite || !site) return NextResponse.json({ erreur: "Site introuvable." }, { status: 404 });
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Sommaire");
  feuille.addRow(COLONNES);

  for (const eq of (equipements ?? []) as Equipement[]) {
    const c = eq.champs_en_tete;
    const type = typesById[eq.type_equipement_id];
    feuille.addRow([
      eq.nom,
      cellNumerique(c.freqEntretienAnnuelle),
      "", // Fréquence courante : dépend de l'historique des relevés (Prompt 6), non calculée ici
      type?.code ?? eq.type_equipement_id,
      eq.groupe,
      site.nom,
      site.site,
      "",
      "",
      eq.numero_equipement,
      champ(c, "typeEquipement1"),
      champ(c, "typeEquipement2"),
      champ(c, "typeEquipement3"),
      champ(c, "marque"),
      champ(c, "dateMES"),
      champ(c, "referenceUInt"),
      champ(c, "referenceUExt"),
      champ(c, "numSerieUInt"),
      champ(c, "numSerieUExt"),
      eq.localisation,
      champ(c, "dateIntervPrevue"),
      champ(c, "nomTech"),
      champ(c, "typeRefrigerant"),
      cellNumerique(c.chargeRefrigerant),
      champ(c, "tensionAlim"),
      champ(c, "puissance"),
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const nomFichier = `${site.nom}_${site.site}_equipements.xlsx`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}

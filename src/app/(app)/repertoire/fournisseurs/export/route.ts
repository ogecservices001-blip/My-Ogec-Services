import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";
import { tvaSurFacture, type Interlocuteur } from "@/lib/validation/fournisseur";
import type { Fournisseur } from "@/lib/types";

const ENTETES = [
  "Noms Fournisseurs",
  "Dénomination courte Fournisseurs",
  "Nature Fourniture",
  "Interlocuteurs",
  "Tel",
  "Portable",
  "email",
  "Adresse",
  "Complément d'adresse",
  "Code postal",
  "Ville",
  "Localisation",
  "Raison sociale exacte",
  "Forme juridique",
  "SIREN (9 chiffres)",
  "SIRET (14 chiffres)",
  "N° TVA intracom.",
  "RCS / RM (ville)",
  "TVA sur facture",
  "Délai de paiement",
  "Mode de règlement",
  "CGV reçues",
  "Fiche mise à jour le",
];

/// Exporte tous les fournisseurs, une ligne par interlocuteur (un
/// fournisseur sans interlocuteur donne une seule ligne vide côté
/// contact) — même disposition que le classeur "Base Fournisseurs" du
/// bureau, réimportable tel quel via /repertoire/fournisseurs/importer.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.from("fournisseurs").select("*").order("nom");
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }
  const fournisseurs = (data ?? []) as Fournisseur[];

  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Base Fournisseurs");
  feuille.addRow(ENTETES);

  for (const f of fournisseurs) {
    const interlocuteurs = (f.interlocuteurs as unknown as Interlocuteur[] | null) ?? [];
    const lignes = interlocuteurs.length > 0 ? interlocuteurs : [{ nom: "", tel: "", portable: "", email: "" }];
    for (const it of lignes) {
      feuille.addRow([
        f.nom,
        f.denomination_courte,
        f.nature_fourniture,
        it.nom,
        it.tel,
        it.portable,
        it.email,
        f.adresse,
        f.complement_adresse,
        f.code_postal,
        f.commune,
        f.localisation,
        f.raison_sociale_exacte,
        f.forme_juridique,
        f.siren,
        f.siret,
        f.tva_intracom,
        f.rcs_rm,
        tvaSurFacture(f.localisation),
        f.delai_paiement,
        f.mode_reglement,
        f.cgv_recues,
        f.fiche_maj_le,
      ]);
    }
  }

  finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="fournisseurs.xlsx"',
    },
  });
}

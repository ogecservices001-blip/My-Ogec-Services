import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille, nomFichierAvecDate } from "@/lib/excel-export";
import type { TypeEquipement } from "@/lib/gmao/types";

const OUI_NON = (v: boolean) => (v ? "Oui" : "Non");
const TYPE_REPONSE: Record<string, string> = { bool: "Fait", enum: "Choix", text: "Texte" };

/// Référentiel équipements (familles) en classeur Excel, un onglet par
/// élément : familles, champs de fiche, listes, checklist, mesures. Les
/// colonnes "Repère" sont les identifiants internes, à ne pas modifier :
/// elles relient chaque ligne aux relevés déjà enregistrés.
export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("types_equipement").select("*").order("code");
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });
  const familles = (data ?? []) as TypeEquipement[];

  const workbook = new ExcelJS.Workbook();

  const fFamilles = workbook.addWorksheet("Familles");
  fFamilles.addRow(["Code", "Nom", "Type Equipement 1", "Repère (ne pas modifier)"]);
  for (const f of familles) fFamilles.addRow([f.code, f.nom, f.type_equipement1_fixe, f.id]);

  const fChamps = workbook.addWorksheet("Champs");
  fChamps.addRow([
    "Code famille",
    "Ordre",
    "Libellé",
    "Unité",
    "Numérique",
    "Choix (séparés par ;)",
    "Même ligne que le suivant",
    "Repère (ne pas modifier)",
  ]);
  for (const f of familles) {
    f.champs_en_tete_supplementaires.forEach((c, i) =>
      fChamps.addRow([
        f.code,
        i + 1,
        c.label,
        c.unite ?? "",
        OUI_NON(Boolean(c.numerique)),
        (c.options ?? []).join(" ; "),
        OUI_NON(Boolean(c.memeLigneSuivant)),
        c.cle,
      ]),
    );
  }

  const fListes = workbook.addWorksheet("Listes");
  fListes.addRow(["Code famille", "Liste", "Sous-champ", "Unité", "Repère liste (ne pas modifier)", "Repère sous-champ (ne pas modifier)"]);
  for (const f of familles) {
    for (const l of f.champs_listes) {
      for (const sc of l.sousChamps) fListes.addRow([f.code, l.label, sc.label, sc.unite ?? "", l.cle, sc.cle]);
    }
  }

  const fChecklist = workbook.addWorksheet("Checklist");
  fChecklist.addRow(["Code famille", "N°", "Opération", "Type de réponse (Fait / Choix / Texte)", "Choix (séparés par ;)"]);
  for (const f of familles) {
    for (const item of f.checklist) {
      fChecklist.addRow([f.code, item.rep, item.label, TYPE_REPONSE[item.typeValeur] ?? item.typeValeur, (item.options ?? []).join(" ; ")]);
    }
  }

  const fMesures = workbook.addWorksheet("Mesures");
  fMesures.addRow([
    "Code famille",
    "Groupe",
    "Répétable",
    "Nombre max",
    "Mesure",
    "Unité",
    "Repère groupe (ne pas modifier)",
    "Repère mesure (ne pas modifier)",
  ]);
  for (const f of familles) {
    for (const g of f.groupes_mesures) {
      for (const m of g.champs) {
        fMesures.addRow([f.code, g.label, OUI_NON(g.repetable), g.nombreMax, m.label, m.unite ?? "", g.cle, m.cle]);
      }
    }
  }

  for (const feuille of [fFamilles, fChamps, fListes, fChecklist, fMesures]) finaliserFeuille(feuille);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichierAvecDate("Referentiel_equipements.xlsx")}"`,
    },
  });
}

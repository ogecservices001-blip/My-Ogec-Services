import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const ENTETES = [
  "Nom",
  "Dénomination courte",
  "Interlocuteurs",
  "Tél",
  "Portable",
  "Courriel",
  "Site Web",
  "Commune",
  "Code Postal",
  "Adresse",
  "Complément Adresse",
  "Produits Clés",
  "Remarques",
];

function nettoyer(v: string): string {
  return v.replaceAll(";", ",").replaceAll("\n", " ");
}

/// Exporte tous les fournisseurs en CSV (point-virgule) — même ordre
/// de colonnes que celui attendu par /repertoire/fournisseurs/importer.
export async function GET() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: fournisseurs, error } = await supabase
    .from("fournisseurs")
    .select("*")
    .order("nom");
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 });
  }

  const lignes = [ENTETES.join(";")];
  for (const f of fournisseurs ?? []) {
    lignes.push(
      [
        f.nom,
        f.denomination_courte,
        f.interlocuteurs,
        f.tel,
        f.portable,
        f.courriel,
        f.site_web,
        f.commune,
        f.code_postal,
        f.adresse,
        f.complement_adresse,
        f.produits_cles,
        f.remarques,
      ]
        .map(nettoyer)
        .join(";"),
    );
  }

  return new NextResponse("﻿" + lignes.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fournisseurs.csv"',
    },
  });
}

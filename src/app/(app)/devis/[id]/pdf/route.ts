import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { genererPdfDevis } from "@/lib/devis/pdf";
import { genererPdfBiEtPhotos } from "@/lib/bi/archive";
import { STATUTS_BI_REALISE } from "../../statut";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdminOuAccueil();
  const { id } = await params;
  const supabase = await createClient();

  const { data: devis, error } = await supabase.from("devis").select("*").eq("id", id).single();
  if (error || !devis) return NextResponse.json({ erreur: "Devis introuvable." }, { status: 404 });

  const { data: site } = await supabase.from("sites").select("nom, site").eq("id", devis.site_id).single();

  // Devis facturable : le PDF imprimé reprend aussi ses BI réalisés.
  const { data: bons } = devis.mois_facturation
    ? await supabase.from("bons_intervention").select("*").eq("devis_id", id).order("created_at")
    : { data: [] };
  const bonsRealises = (bons ?? []).filter((b) => STATUTS_BI_REALISE.has(b.statut));
  const bonsIntervention = await Promise.all(bonsRealises.map((b) => genererPdfBiEtPhotos(supabase, b)));

  const pdfBytes = await genererPdfDevis({ devis, site: site ?? null, bonsIntervention });
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${devis.numero || "devis"}.pdf"`,
    },
  });
}

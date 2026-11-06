import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { genererPdfDevis } from "@/lib/devis/pdf";
import type { Tables } from "@/lib/types";

/// PDF d'une version précédente d'un devis révisé, tel qu'il était avant la révision.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  await requireAdminOuAccueil();
  const { id, revisionId } = await params;
  const supabase = await createClient();

  const { data: revision } = await supabase
    .from("devis_revisions")
    .select("*")
    .eq("id", revisionId)
    .eq("devis_id", id)
    .single();
  if (!revision) return NextResponse.json({ erreur: "Version introuvable." }, { status: 404 });

  const devis = revision.donnees as unknown as Tables<"devis">;
  const { data: site } = await supabase.from("sites").select("nom, site").eq("id", devis.site_id).single();

  const pdfBytes = await genererPdfDevis({ devis, site: site ?? null });
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${revision.numero}.pdf"`,
    },
  });
}

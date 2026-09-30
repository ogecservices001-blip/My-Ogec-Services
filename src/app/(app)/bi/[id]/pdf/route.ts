import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { genererPdfAvecPhotos } from "@/lib/bi/archive";
import type { Tables } from "@/lib/types";

/// "Voir PDF" — régénéré à la volée depuis les données actuelles du
/// bon à chaque consultation, jamais depuis l'archive Storage (voir
/// @/lib/bi/pdf).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: bon, error } = await supabase.from("bons_intervention").select("*").eq("id", id).single();
  if (error || !bon) return NextResponse.json({ erreur: "Bon introuvable." }, { status: 404 });

  const pdfBytes = await genererPdfAvecPhotos(supabase, bon as Tables<"bons_intervention">);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${bon.numero || "bon-intervention"}.pdf"`,
    },
  });
}

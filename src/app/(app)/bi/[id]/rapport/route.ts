import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { chargerRapportVisite, genererPdfRapportVisite, nomFichierRapport } from "@/lib/gmao/rapport-visite";

/// Rapport technique de la visite (BI Entretien sous contrat validé + relevés rattachés).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const chargement = await chargerRapportVisite(supabase, id);
  if (!chargement.ok) return NextResponse.json({ erreur: chargement.erreur }, { status: 404 });

  const pdf = await genererPdfRapportVisite(chargement.donnees);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomFichierRapport(chargement.donnees.bi)}"`,
    },
  });
}

import { NextResponse } from "next/server";
import { biAutorise, reponsePdf } from "@/lib/espace-client/pdf";
import { chargerRapportVisite, genererPdfRapportVisite, nomFichierRapport } from "@/lib/gmao/rapport-visite";

/// Rapport technique d'une visite d'entretien (BI validé + relevés).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acces = await biAutorise(id);
  if (!acces.ok) return acces.reponse;

  const chargement = await chargerRapportVisite(acces.admin, id);
  if (!chargement.ok) return NextResponse.json({ erreur: "Rapport indisponible." }, { status: 404 });
  return reponsePdf(await genererPdfRapportVisite(chargement.donnees), nomFichierRapport(chargement.donnees.bi));
}

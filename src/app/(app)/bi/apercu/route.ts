import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { genererPdfApercuBI } from "@/lib/bi/pdf";
import type { BiInput } from "../nouveau/actions";

/// Aperçu avant signature : PDF généré depuis la saisie en cours de
/// l'assistant. Aucune écriture en base, donc ni numéro ni ligne créés.
export async function POST(request: Request) {
  await requireProfile();

  let input: BiInput;
  try {
    input = (await request.json()) as BiInput;
  } catch {
    return NextResponse.json({ erreur: "Données invalides." }, { status: 400 });
  }

  const pdfBytes = await genererPdfApercuBI({
    ...input,
    numero: "",
    numero_devis: "",
    heure_debut: "",
    heure_fin: "",
    sig_tech: "",
    sig_client: "",
    date_signature: "",
  });
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Apercu-BI.pdf"',
      "Cache-Control": "no-store",
    },
  });
}

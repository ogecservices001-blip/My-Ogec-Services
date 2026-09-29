import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

/// Lecture de texte sur une photo (plaque signalétique) via Google
/// Cloud Vision — remplace Tesseract.js (trop lent/imprécis dans le
/// navigateur) par le même type de moteur que Google ML Kit (utilisé
/// nativement par l'ancienne appli Flutter), appelé côté serveur : la
/// clé API n'est jamais exposée au client.
export async function POST(request: Request) {
  await requireProfile();

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ erreur: "OCR non configuré côté serveur." }, { status: 500 });
  }

  const formData = await request.formData();
  const fichier = formData.get("image");
  if (!(fichier instanceof File)) {
    return NextResponse.json({ erreur: "Aucune image reçue." }, { status: 400 });
  }

  const buffer = Buffer.from(await fichier.arrayBuffer());
  const base64 = buffer.toString("base64");

  const reponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "TEXT_DETECTION" }],
          imageContext: { languageHints: ["fr"] },
        },
      ],
    }),
  });

  if (!reponse.ok) {
    return NextResponse.json({ erreur: "Échec de l'appel OCR." }, { status: 502 });
  }

  const data = await reponse.json();
  const texteComplet: string = data.responses?.[0]?.fullTextAnnotation?.text ?? "";
  const lignes = texteComplet
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  return NextResponse.json({ lignes });
}

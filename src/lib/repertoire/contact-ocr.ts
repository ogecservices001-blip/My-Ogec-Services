import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ContactExtrait = z.object({
  nom: z.string().default("").describe("Prénom et nom de la personne qui signe, sans sa fonction ni son service"),
  fixe: z.string().default("").describe("Téléphone fixe (ligne « Fixe », « Tél », « Standard »…)"),
  portable: z.string().default("").describe("Téléphone portable (ligne « Mobile », « Portable », « GSM »…)"),
  courriel: z.string().default("").describe("Adresse e-mail de la personne"),
});

export type ContactExtraitResultat = z.infer<typeof ContactExtrait>;

const PROMPT =
  "Voici une capture d'écran d'une signature de mail (ou un document contenant les coordonnées d'une personne). " +
  "Extrais uniquement les coordonnées de la personne qui signe : son prénom et nom (sans fonction ni service), " +
  "son téléphone fixe, son téléphone portable et son adresse e-mail. Laisse vide tout champ absent — n'invente rien.";

/// Lit une signature de mail (image ou PDF) pour pré-remplir un contact de
/// site — toujours relu et corrigé par le bureau avant enregistrement.
export async function extraireContactDepuisCapture(fichier: { bytes: Buffer; mimeType: string }): Promise<ContactExtraitResultat> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Lecture automatique non configurée (ANTHROPIC_API_KEY manquant).");

  const client = new Anthropic({ apiKey });
  const base64 = fichier.bytes.toString("base64");
  const contenuFichier: Anthropic.Messages.ContentBlockParam =
    fichier.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : {
          type: "image",
          source: { type: "base64", media_type: fichier.mimeType as "image/png" | "image/jpeg" | "image/webp", data: base64 },
        };

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: [contenuFichier, { type: "text", text: PROMPT }] }],
    output_config: { format: zodOutputFormat(ContactExtrait) },
  });

  if (!response.parsed_output) throw new Error("Lecture automatique impossible sur cette capture.");
  return response.parsed_output;
}

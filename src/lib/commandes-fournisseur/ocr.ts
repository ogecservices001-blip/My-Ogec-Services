import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LigneCommande } from "./format";

const LigneExtraite = z.object({
  code: z.string().default(""),
  designation: z.string(),
  quantite: z.string(),
  prix_unitaire: z.string().describe("Prix unitaire HT, chiffres uniquement (pas de symbole monétaire)"),
});

const DevisExtrait = z.object({ lignes: z.array(LigneExtraite) });

const PROMPT =
  "Voici un devis ou bon de commande fournisseur (PDF ou photo). Extrais chaque ligne d'article : " +
  "code article (s'il y en a un, sinon laisse vide), désignation, quantité, prix unitaire HT " +
  "(nombre seul, virgule ou point comme séparateur décimal, sans symbole monétaire). " +
  "Ignore les lignes de total, sous-total, TVA, port — uniquement les articles.";

/// Lit un devis fournisseur (PDF ou image) et en extrait les lignes
/// d'articles via Claude (vision + sortie structurée) — jamais appliqué
/// tel quel, toujours relu/corrigé par le bureau avant enregistrement.
export async function extraireLignesDevisFournisseur(fichier: {
  bytes: Buffer;
  mimeType: string;
}): Promise<LigneCommande[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Lecture automatique non configurée (ANTHROPIC_API_KEY manquant).");

  const client = new Anthropic({ apiKey });
  const base64 = fichier.bytes.toString("base64");

  const contenuFichier: Anthropic.Messages.ContentBlockParam =
    fichier.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : {
          type: "image",
          source: { type: "base64", media_type: fichier.mimeType as "image/png" | "image/jpeg", data: base64 },
        };

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: [contenuFichier, { type: "text", text: PROMPT }] }],
    output_config: { format: zodOutputFormat(DevisExtrait) },
  });

  if (!response.parsed_output) throw new Error("Lecture automatique impossible sur ce fichier.");
  return response.parsed_output.lignes;
}

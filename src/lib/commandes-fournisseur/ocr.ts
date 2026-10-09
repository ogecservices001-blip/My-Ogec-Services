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

const DevisExtrait = z.object({
  numero_devis: z.string().default("").describe("Numéro/référence du devis attribué par le fournisseur"),
  date_devis: z.string().default("").describe("Date du devis, au format jj/mm/aaaa"),
  nom_societe: z.string().default("").describe("Nom de la société émettrice (le fournisseur)"),
  nom_contact: z.string().default("").describe("Nom de la personne (interlocuteur/commercial) indiquée sur le document, si présent"),
  validite_offre: z.string().default("").describe("Durée ou date de validité de l'offre indiquée sur le document, telle qu'écrite (ex: \"30 jours\", \"valable jusqu'au 15/11/2026\")"),
  conditions_paiement: z.string().default("").describe("Conditions de paiement indiquées sur le document, telles qu'écrites (ex: \"30% à la commande, solde à la livraison\", \"comptant\", \"30 jours net\")"),
  incoterm: z.string().default("").describe("Code Incoterm à 3 lettres si indiqué (EXW, FCA, FOB, CFR, CIF, DAP, DDP...), sinon vide"),
  lignes: z.array(LigneExtraite),
});

export type DevisExtraitResultat = z.infer<typeof DevisExtrait>;

const PROMPT =
  "Voici un devis ou bon de commande fournisseur (PDF ou photo). Extrais : " +
  "le numéro de devis, sa date, le nom de la société émettrice (le fournisseur), le nom de la personne " +
  "(interlocuteur/commercial) indiquée sur le document si présent, la durée ou date de validité de l'offre " +
  "si elle est indiquée, les conditions de paiement si elles sont indiquées, l'Incoterm si indiqué, " +
  "et chaque ligne d'article : code article (s'il y en a un, sinon laisse vide), désignation, quantité, " +
  "prix unitaire HT (nombre seul, virgule ou point comme séparateur décimal, sans symbole monétaire). " +
  "Pour les lignes, ignore les lignes de total, sous-total, TVA, port — uniquement les articles.";

/// Lit un devis fournisseur (PDF ou image) et en extrait l'en-tête
/// (numéro, date, société, contact) et les lignes d'articles via Claude
/// (vision + sortie structurée) — jamais appliqué tel quel, toujours
/// relu/corrigé par le bureau avant enregistrement.
export async function extraireDevisFournisseur(fichier: {
  bytes: Buffer;
  mimeType: string;
}): Promise<DevisExtraitResultat> {
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
  return response.parsed_output;
}

export type { LigneCommande };

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const CommandeExtraite = z.object({
  type_document: z
    .enum(["bon_de_commande", "devis_signe", "autre"])
    .describe(
      "bon_de_commande : document émis par le client. devis_signe : devis d'OGEC Services renvoyé signé et/ou tamponné par le client. autre : ni l'un ni l'autre.",
    ),
  numero_commande: z.string().default("").describe("Numéro du bon de commande du client. Vide pour un devis signé sans numéro de commande."),
  date_commande: z
    .string()
    .default("")
    .describe("Date de la commande au format JJ/MM/AAAA. Pour un devis signé : la date de signature si elle est écrite."),
  signataire: z.string().default("").describe("Nom de la personne qui signe ou passe la commande, si lisible."),
  montant_ht: z.number().nullable().default(null).describe("Montant total HORS TAXES de la commande, en euros. null si absent."),
  conditions_paiement: z.string().default("").describe("Conditions ou délai de paiement (ex : \"45 jours fin de mois\"), tels qu'écrits."),
  facturation: z
    .object({
      raison_sociale: z.string().default(""),
      adresse: z.string().default(""),
      complement_adresse: z.string().default(""),
      code_postal: z.string().default(""),
      commune: z.string().default(""),
      siret: z.string().default("").describe("SIRET du CLIENT (14 chiffres), jamais celui d'OGEC Services"),
      tva_intracom: z.string().default("").describe("N° de TVA intracommunautaire du CLIENT, jamais celui d'OGEC Services"),
    })
    .describe("Entité du CLIENT à facturer (adresse de facturation, mentions légales du client, tampon)."),
  contact: z
    .object({
      nom: z.string().default(""),
      telephone: z.string().default(""),
      email: z.string().default(""),
    })
    .describe("Contact côté CLIENT pour cette commande."),
  lignes: z
    .array(z.object({ designation: z.string().default(""), montant_ht: z.number().nullable().default(null) }))
    .default([])
    .describe("Lignes commandées avec leur montant HT."),
});

export type CommandeExtraiteResultat = z.infer<typeof CommandeExtraite>;

const PROMPT =
  "Voici un document reçu d'un client d'OGEC Services (Omnium Génie Climatique Services, 918 chemin Tour des Roches, " +
  "97460 Saint-Paul), entreprise de climatisation. C'est soit le bon de commande émis par le client, soit un devis " +
  "d'OGEC Services renvoyé signé et/ou tamponné par le client. Extrais les informations de la commande et du CLIENT. " +
  "OGEC Services est toujours le fournisseur : ne prends jamais son nom, son adresse, son SIRET, son TVA ou son " +
  "téléphone comme ceux du client. L'adresse de livraison correspond au site d'intervention, pas à la facturation : " +
  "pour la facturation, prends l'adresse de facturation, les mentions légales du client ou son tampon. Donne le " +
  "montant total hors taxes. Laisse vide tout champ absent ou illisible — n'invente rien.";

/// Lit la commande d'un client (PDF ou image) pour proposer au bureau la date,
/// le numéro et l'enrichissement de la fiche client — jamais appliqué tel quel.
export async function extraireCommandeClient(fichier: { bytes: Buffer; mimeType: string }): Promise<CommandeExtraiteResultat> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Lecture automatique non configurée (ANTHROPIC_API_KEY manquant).");

  const client = new Anthropic({ apiKey });
  const base64 = fichier.bytes.toString("base64");
  const contenuFichier: Anthropic.Messages.ContentBlockParam =
    fichier.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: fichier.mimeType as "image/png" | "image/jpeg", data: base64 } };

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: [contenuFichier, { type: "text", text: PROMPT }] }],
    output_config: { format: zodOutputFormat(CommandeExtraite) },
  });

  if (!response.parsed_output) throw new Error("Lecture automatique impossible sur ce fichier.");
  return response.parsed_output;
}

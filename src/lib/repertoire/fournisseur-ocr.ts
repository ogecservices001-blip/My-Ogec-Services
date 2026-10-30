import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const InterlocuteurExtrait = z.object({
  nom: z.string().default(""),
  tel: z.string().default("").describe("Téléphone fixe — ou le seul numéro trouvé si fixe/portable ne sont pas distingués"),
  portable: z.string().default("").describe("Téléphone portable/mobile UNIQUEMENT s'il est explicitement distingué du fixe sur le document"),
  email: z.string().default(""),
});

const FournisseurExtrait = z.object({
  nom: z
    .string()
    .default("")
    .describe(
      "Nom commercial de la société ÉMETTRICE du document (le fournisseur), tel qu'affiché en en-tête — " +
        "jamais le client destinataire du devis/de la facture.",
    ),
  nature_fourniture: z.string().default("").describe("Activité/spécialité du fournisseur si mentionnée (ex: sous le nom de la société, en en-tête)"),
  site_web: z.string().default(""),
  adresse: z.string().default(""),
  complement_adresse: z.string().default(""),
  code_postal: z.string().default(""),
  commune: z.string().default(""),
  raison_sociale_exacte: z
    .string()
    .default("")
    .describe("Raison sociale légale complète (avec forme juridique) si elle diffère du nom commercial, telle qu'écrite dans les mentions légales"),
  forme_juridique: z.string().default("").describe("Ex: SARL, SAS, EURL, SA..."),
  siren: z.string().default(""),
  siret: z.string().default(""),
  tva_intracom: z.string().default("").describe("Numéro de TVA intracommunautaire"),
  rcs_rm: z.string().default("").describe("Mention RCS (Registre du Commerce) ou RM (Répertoire des Métiers), telle qu'écrite"),
  delai_paiement: z
    .string()
    .default("")
    .describe("UNIQUEMENT le délai de paiement (ex: \"60 jours\", \"30 jours fin de mois\", \"comptant\") — jamais le moyen de paiement ni une clause CGV complète"),
  mode_reglement: z.string().default("").describe("Moyen de paiement indiqué (chèque, virement, prélèvement...), si précisé"),
  iban: z.string().default("").describe("IBAN du RIB fournisseur si un RIB figure sur le document"),
  bic: z.string().default("").describe("BIC/SWIFT du RIB fournisseur si un RIB figure sur le document"),
  interlocuteurs: z.array(InterlocuteurExtrait).default([]),
});

export type FournisseurExtraitResultat = z.infer<typeof FournisseurExtrait>;

const PROMPT =
  "Voici un devis ou une facture fournisseur (PDF, photo ou capture d'écran). Extrais toutes les informations " +
  "disponibles permettant de créer sa fiche dans un répertoire fournisseurs : le nom commercial de la société " +
  "ÉMETTRICE du document (jamais le client destinataire), son activité/spécialité si mentionnée, son site web, " +
  "son adresse complète (adresse, complément, code postal, commune), sa raison sociale légale exacte si elle " +
  "diffère du nom commercial (telle qu'écrite dans les mentions légales en bas de page), sa forme juridique " +
  "(SARL, SAS...), son SIREN, son SIRET, son numéro de TVA intracommunautaire, sa mention RCS ou RM, le délai de " +
  "paiement indiqué (uniquement le délai en tant que tel, jamais le moyen de paiement ni une clause CGV " +
  "complète), le mode de règlement s'il est précisé (chèque, virement...), l'IBAN et le BIC/SWIFT du RIB si un " +
  "RIB figure sur le document, et chaque interlocuteur identifiable (nom, téléphone fixe, téléphone portable " +
  "UNIQUEMENT s'il est explicitement distingué du fixe, email). Laisse vide tout champ absent du document — " +
  "n'invente rien.";

/// Lit un devis/facture fournisseur (PDF ou image) pour pré-remplir une
/// NOUVELLE fiche du répertoire Fournisseurs — jamais appliqué tel
/// quel, toujours relu/corrigé par le bureau avant enregistrement.
export async function extraireFournisseurDepuisDevis(fichier: {
  bytes: Buffer;
  mimeType: string;
}): Promise<FournisseurExtraitResultat> {
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
    max_tokens: 2048,
    messages: [{ role: "user", content: [contenuFichier, { type: "text", text: PROMPT }] }],
    output_config: { format: zodOutputFormat(FournisseurExtrait) },
  });

  if (!response.parsed_output) throw new Error("Lecture automatique impossible sur ce fichier.");
  return response.parsed_output;
}

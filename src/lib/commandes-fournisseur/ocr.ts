import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LigneCommande } from "./format";

const LigneExtraite = z.object({
  code: z.string().default(""),
  designation: z.string(),
  quantite: z.string(),
  prix_unitaire: z.string().describe("Prix unitaire HT, chiffres uniquement (pas de symbole monétaire)"),
  remise: z.string().default("").describe("Remise en %, chiffre seul sans le symbole %, vide si aucune remise sur cette ligne"),
});

const DevisExtrait = z.object({
  numero_devis: z.string().default("").describe("Numéro/référence du devis attribué par le fournisseur"),
  date_devis: z.string().default("").describe("Date du devis, au format jj/mm/aaaa"),
  nom_societe: z
    .string()
    .default("")
    .describe(
      "Raison sociale COMPLÈTE de la société émettrice (le fournisseur), telle qu'imprimée en en-tête du document " +
        "— jamais un sigle, une abréviation ou un code interne même s'il apparaît en gros sur le document.",
    ),
  nom_contact: z.string().default("").describe("Nom de la personne (interlocuteur/commercial) indiquée sur le document, si présent"),
  validite_offre: z.string().default("").describe("Durée ou date de validité de l'offre indiquée sur le document, telle qu'écrite (ex: \"30 jours\", \"valable jusqu'au 15/11/2026\")"),
  conditions_paiement: z.string().default("").describe("Conditions de paiement indiquées sur le document, telles qu'écrites (ex: \"30% à la commande, solde à la livraison\", \"comptant\", \"30 jours net\")"),
  delai_paiement: z
    .string()
    .default("")
    .describe(
      "UNIQUEMENT le délai de paiement en tant que tel (ex: \"60 jours\", \"30 jours fin de mois\", \"comptant\") " +
        "— jamais le moyen de paiement (chèque, virement...) ni une clause CGV complète (pénalités de retard, " +
        "escompte, distinction clients en compte/hors compte...). Vide si aucun délai chiffré/nommé n'est indiqué.",
    ),
  incoterm: z.string().default("").describe("Code Incoterm à 3 lettres si indiqué (EXW, FCA, FOB, CFR, CIF, DAP, DDP...), sinon vide"),
  taux_tva: z
    .string()
    .default("")
    .describe(
      "Taux de TVA en %, chiffre seul, UNIQUEMENT s'il est clairement indiqué comme un pourcentage sur le " +
        "document (ex: \"TVA 8,5%\") — jamais un simple code interne (ex: \"9\") sans le symbole %.",
    ),
  montant_ttc: z
    .string()
    .default("")
    .describe(
      "Montant TTC total du devis (toutes lignes confondues), chiffres uniquement, si indiqué sur le document — " +
        "sert à vérifier/déduire le taux de TVA réel quand il n'est pas donné explicitement en %.",
    ),
  produits_cles: z
    .string()
    .default("")
    .describe("Activité/spécialité du fournisseur si mentionnée sur le document (ex: sous le nom de la société, en en-tête), sinon vide"),
  lignes: z.array(LigneExtraite),
});

export type DevisExtraitResultat = z.infer<typeof DevisExtrait>;

const PROMPT =
  "Voici un devis ou bon de commande fournisseur (PDF ou photo). Extrais : " +
  "le numéro de devis, sa date, la raison sociale complète de la société émettrice (le fournisseur), le nom de la " +
  "personne (interlocuteur/commercial) indiquée sur le document si présent, la durée ou date de validité de " +
  "l'offre si elle est indiquée, les conditions de paiement si elles sont indiquées, et séparément le seul délai " +
  "de paiement proprement dit (ex: \"60 jours\", \"30 jours fin de mois\", \"comptant\" — jamais le moyen de " +
  "paiement comme chèque/virement, ni une clause CGV complète), l'Incoterm si indiqué, " +
  "le taux de TVA en % s'il est clairement écrit comme un pourcentage (pas un simple code numérique interne), " +
  "le montant TTC total du devis s'il est indiqué, l'activité/spécialité du fournisseur si elle est mentionnée, " +
  "et CHAQUE ligne facturable du tableau d'articles : code article (s'il y en a un, sinon laisse vide), " +
  "désignation, quantité, prix unitaire HT (nombre seul, virgule ou point comme séparateur décimal, sans " +
  "symbole monétaire), et la remise en % si une colonne Remise existe et qu'elle est renseignée sur cette ligne. " +
  "Inclus TOUTE ligne qui porte sa propre quantité et son propre montant, même les lignes secondaires sous un " +
  "article principal (éco-contribution, écotaxe, DEEE, frais par ligne...) — ce sont de vraies lignes " +
  "facturables, pas des sous-totaux. N'ignore QUE les lignes de synthèse en bas de tableau (total, sous-total, " +
  "cumul de taxe, base TVA, montant TVA, port, frais de gestion global) qui ne portent pas leur propre article.";

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

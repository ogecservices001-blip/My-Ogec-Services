import nodemailer from "nodemailer";
import type { Tables } from "@/lib/types";
import { labelPole } from "./constants";
import { equipementLabel } from "./format";

type Bon = Tables<"bons_intervention">;

const GMAIL_USER = "ogecservices001@gmail.com";

function ligne(label: string, valeur: string): string {
  if (!valeur) return "";
  return `<tr><td style="background:#eef1e3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:220px;">${label}</td><td style="padding:8px 12px;border:1px solid #ccc;">${valeur}</td></tr>`;
}

/// Envoie le bon d'intervention signé au client, PDF en pièce jointe —
/// même mécanisme Gmail que la confirmation dépannage
/// (envoyerConfirmationDepannage), déclenché manuellement par le
/// bureau (voir envoyerBiParEmail).
export async function envoyerConfirmationBI(params: {
  bon: Bon;
  pdfBytes: Buffer;
  informationComplementaire: string;
}): Promise<void> {
  const { bon, pdfBytes, informationComplementaire } = params;
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");

  const html = `
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint le bon d'intervention correspondant à notre passage.</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      ${ligne("N° Intervention", bon.numero)}
      ${ligne("Pôle", `${bon.pole} · ${labelPole(bon.pole)}`)}
      ${ligne("Client", [bon.client_nom, bon.site].filter(Boolean).join(" — "))}
      ${ligne("Date d'intervention", bon.date_intervention || bon.date_debut)}
      ${bon.equipement_nom ? ligne("Équipement", equipementLabel(bon)) : ""}
      ${informationComplementaire ? ligne("Information complémentaire", informationComplementaire) : ""}
    </table>
  `;

  const transporteur = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: motDePasse },
  });

  await transporteur.sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    to: bon.email,
    subject: `Bon d'intervention N°${bon.numero} — ${bon.client_nom}`,
    html,
    attachments: [{ filename: `${bon.numero}.pdf`, content: pdfBytes, contentType: "application/pdf" }],
  });
}

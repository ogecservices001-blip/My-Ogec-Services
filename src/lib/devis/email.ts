import nodemailer from "nodemailer";
import type { Tables } from "@/lib/types";

type Devis = Tables<"devis">;

const GMAIL_USER = "ogecservices001@gmail.com";

/// Envoie le devis au client, PDF en pièce jointe — même mécanisme
/// Gmail que l'envoi des commandes fournisseur (@/lib/commandes-fournisseur/email),
/// déclenché manuellement par le bureau (voir envoyerDevisParEmail).
export async function envoyerDevis(params: {
  devis: Devis;
  site: { nom: string; site: string } | null;
  destinataire: string;
  pdfBytes: Buffer;
}): Promise<void> {
  const { devis, site, destinataire, pdfBytes } = params;
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");

  const html = `
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint notre devis ${devis.numero}${site ? ` concernant ${[site.nom, site.site].filter(Boolean).join(" — ")}` : ""}.</p>
    <p>Nous restons à votre disposition pour toute question.</p>
    <p>Cordialement,<br/>${devis.redacteur}<br/>OGEC Services</p>
  `;

  const transporteur = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: motDePasse },
  });

  await transporteur.sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    to: destinataire,
    subject: `Devis ${devis.numero}${devis.libelle ? ` — ${devis.libelle}` : ""}`,
    html,
    attachments: [{ filename: `${devis.numero || "devis"}.pdf`, content: pdfBytes, contentType: "application/pdf" }],
  });
}

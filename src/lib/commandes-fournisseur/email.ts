import nodemailer from "nodemailer";
import type { Tables } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";

type Commande = Tables<"commandes_fournisseur">;
type Fournisseur = Tables<"fournisseurs">;

const GMAIL_USER = "ogecservices001@gmail.com";

/// Envoie le bon de commande au fournisseur, PDF en pièce jointe — même
/// mécanisme Gmail que la confirmation BI (@/lib/bi/email), déclenché
/// manuellement par le bureau (voir envoyerCommandeParEmail).
export async function envoyerCommandeFournisseur(params: {
  commande: Commande;
  fournisseur: Fournisseur;
  interlocuteur: Interlocuteur;
  pdfBytes: Buffer;
}): Promise<void> {
  const { commande, fournisseur, interlocuteur, pdfBytes } = params;
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");

  const html = `
    <p>Bonjour${interlocuteur.nom ? ` ${interlocuteur.nom}` : ""},</p>
    <p>Nous vous prions de bien vouloir trouver ci-joint notre commande ${commande.numero}${
      commande.devis_fournisseur_numero
        ? ` correspondant à votre devis ${commande.devis_fournisseur_numero}${commande.devis_fournisseur_date ? ` du ${commande.devis_fournisseur_date}` : ""}`
        : ""
    }.</p>
    <p>Veuillez accuser réception de ce bon de commande et nous confirmer la date de livraison ou de mise à disposition.</p>
    <p>Merci par avance.</p>
    <p>Cordialement,<br/>${commande.redacteur}<br/>OGEC Services</p>
  `;

  const transporteur = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: motDePasse },
  });

  await transporteur.sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    to: interlocuteur.email,
    subject: `Commande ${commande.numero} — ${fournisseur.nom}`,
    html,
    attachments: [{ filename: `${commande.numero}.pdf`, content: pdfBytes, contentType: "application/pdf" }],
  });
}

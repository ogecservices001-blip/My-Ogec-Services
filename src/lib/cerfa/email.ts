import nodemailer from "nodemailer";

const GMAIL_USER = "ogecservices001@gmail.com";

function transporteur() {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");
  return nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: motDePasse } });
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/// Même texte que l'écran « Envoi mail client » de l'ancienne appli, mais
/// avec le PDF réellement joint.
export async function envoyerCerfaEmail(params: {
  destinataires: string[];
  site: string;
  equipement: string;
  numero: string;
  nomFichier: string;
  pdf: Buffer;
}): Promise<void> {
  const { destinataires, site, equipement, numero, nomFichier, pdf } = params;
  const html = `
    <p>Bonjour,</p>
    <p>Nous vous prions de bien vouloir trouver en pièce jointe votre certificat de contrôle d'étanchéité pour votre équipement suivant :</p>
    <p>Site : ${echapper(site)}<br/>Équipement : ${echapper(equipement)}<br/>Numéro du CERFA : ${echapper(numero)}</p>
    <p>Cordialement,</p>
    <p>L'équipe OGEC Services</p>
  `;
  await transporteur().sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    replyTo: "ogec.services@orange.fr",
    to: destinataires,
    subject: `CERFA 15497 – ${site} – ${equipement}`,
    html,
    attachments: [{ filename: nomFichier, content: pdf, contentType: "application/pdf" }],
  });
}

/// Récapitulatif « Point sur les CERFA » envoyé au bureau.
export async function envoyerRecapCerfa(params: { destinataire: string; objet: string; corps: string }): Promise<void> {
  await transporteur().sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    replyTo: "ogec.services@orange.fr",
    to: params.destinataire,
    subject: params.objet,
    text: params.corps,
  });
}

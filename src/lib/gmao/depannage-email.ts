import nodemailer from "nodemailer";

const GMAIL_USER = "ogecservices001@gmail.com";
const BUREAU_EMAIL = "ogec.services@orange.fr";

/// Notifie le bureau par email d'une nouvelle demande de dépannage —
/// port de l'envoi nodemailer de `soumettreDemandeDepannage`
/// (functions/index.js). Sans effet si `GMAIL_APP_PASSWORD` n'est pas
/// configuré : l'enregistrement de la demande reste fait, seule la
/// notification est sautée (même résilience que côté Flutter : "un
/// échec d'envoi n'empêche pas l'enregistrement").
export async function envoyerNotificationDepannage(params: {
  clientNom: string;
  clientSite: string;
  equipementNom: string;
  email: string;
  message: string;
}): Promise<void> {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) return;

  const transporteur = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: motDePasse },
  });

  await transporteur.sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    to: BUREAU_EMAIL,
    subject: `Nouvelle demande de dépannage — ${params.clientNom} ${params.clientSite}`.trim(),
    text:
      `Équipement : ${params.equipementNom}\n` +
      `Site : ${params.clientNom} — ${params.clientSite}\n` +
      `Email du demandeur : ${params.email}\n\n` +
      `Message :\n${params.message}`,
  });
}

import nodemailer from "nodemailer";

const GMAIL_USER = "ogecservices001@gmail.com";
const BUREAU_EMAIL = "ogec.services@orange.fr";

function transporteur() {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");
  return nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: motDePasse } });
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/// Lien « mot de passe oublié » envoyé au technicien.
export async function envoyerLienReinitialisation(params: { destinataire: string; nom: string; lien: string }): Promise<void> {
  const { destinataire, nom, lien } = params;
  await transporteur().sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    replyTo: "ogec.services@orange.fr",
    to: destinataire,
    subject: "OGEC Services – Nouveau mot de passe",
    html: `
      <p>Bonjour ${echapper(nom)},</p>
      <p>Tu as demandé un nouveau mot de passe pour l'application OGEC Services.</p>
      <p><a href="${lien}" style="display:inline-block;padding:10px 18px;background:#4f9a41;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Choisir mon nouveau mot de passe</a></p>
      <p>Ce lien est valable une heure et ne sert qu'une fois. Si tu n'as rien demandé, ignore ce message : ton mot de passe actuel reste valable.</p>
      <p>L'équipe OGEC Services</p>
    `,
  });
}

/// Le bureau est prévenu de chaque demande.
export async function signalerDemandeMotDePasse(nom: string, quand: Date): Promise<void> {
  const date = quand.toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" });
  const heure = quand
    .toLocaleTimeString("fr-FR", { timeZone: "Indian/Reunion", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
  const texte = `Le technicien ${nom} a demandé son mot de passe le ${date} à ${heure}.`;
  await transporteur().sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    replyTo: "ogec.services@orange.fr",
    to: BUREAU_EMAIL,
    subject: `Mot de passe oublié – ${nom}`,
    text: `${texte}\n\nUn lien pour choisir un nouveau mot de passe lui a été envoyé par mail.`,
  });
}

import nodemailer from "nodemailer";
import { URL_APPLI } from "@/lib/planning/validation";

const GMAIL_USER = "ogecservices001@gmail.com";
const BUREAU_EMAIL = "ogec.services@orange.fr";

function transporteur() {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");
  return nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: motDePasse } });
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const lienConnexion = (jeton: string) => `${URL_APPLI.replace(/\/$/, "")}/mon-contrat/connexion?t=${encodeURIComponent(jeton)}`;

const bouton = (href: string, texte: string) =>
  `<p><a href="${href}" style="display:inline-block;padding:11px 20px;background:#4f9a41;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">${texte}</a></p>`;

/// Lien de connexion demandé par le client.
export async function envoyerLienConnexion(destinataire: string, jeton: string): Promise<void> {
  await transporteur().sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    replyTo: BUREAU_EMAIL,
    to: destinataire,
    subject: "Votre lien de connexion — Mon contrat OGEC",
    html: `
      <p>Bonjour,</p>
      <p>Voici votre lien de connexion à <strong>Mon contrat OGEC</strong>.</p>
      ${bouton(lienConnexion(jeton), "Accéder à Mon contrat OGEC")}
      <p>Ce lien est valable 30 minutes et ne sert qu'une fois. Vous resterez ensuite connecté 30 jours sur cet appareil.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p>
      <p>Cordialement,<br/>L'équipe OGEC Services</p>
    `,
  });
}

/// Invitation envoyée par le bureau à l'activation d'un contact.
export async function envoyerInvitation(params: { destinataire: string; nom: string; site: string; jeton: string }): Promise<void> {
  await transporteur().sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    replyTo: BUREAU_EMAIL,
    to: params.destinataire,
    subject: "OGEC Services vous ouvre votre espace « Mon contrat OGEC »",
    html: `
      <p>Bonjour${params.nom ? ` ${echapper(params.nom)}` : ""},</p>
      <p>OGEC Services vous ouvre l'accès à <strong>Mon contrat OGEC</strong> pour le site <strong>${echapper(params.site)}</strong>.</p>
      <p>Vous y retrouvez vos prochains passages, l'historique des visites d'entretien et leurs rapports, à tout moment.</p>
      ${bouton(lienConnexion(params.jeton), "Découvrir mon espace")}
      <p>Ce lien est valable 7 jours et ne sert qu'une fois. Par la suite, il vous suffira de saisir votre adresse email sur la page de connexion pour recevoir un nouveau lien :<br/>
      <a href="${URL_APPLI.replace(/\/$/, "")}/mon-contrat">${URL_APPLI.replace(/\/$/, "")}/mon-contrat</a></p>
      <p>Pour toute question : ${BUREAU_EMAIL}</p>
      <p>Cordialement,<br/>L'équipe OGEC Services</p>
    `,
  });
}

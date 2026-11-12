import nodemailer from "nodemailer";
import { libelleJours } from "./periode";

export { libelleJours };

export const EMAIL_BUREAU = "ogecservices001@gmail.com";

export type { JourDemande } from "./periode";
import type { JourDemande } from "./periode";

export type InfosDemande = {
  client_nom: string;
  site: string;
  objet: string;
  jours: JourDemande[];
};

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");


function tableau(infos: InfosDemande): string {
  const ligne = (l: string, v: string) =>
    v
      ? `<tr><td style="background:#eef1e3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:170px;vertical-align:top;">${l}</td><td style="padding:8px 12px;border:1px solid #ccc;">${v}</td></tr>`
      : "";
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;margin:12px 0;">
    ${ligne("Client", echapper([infos.client_nom, infos.site].filter(Boolean).join(" — ")))}
    ${ligne("Objet", echapper(infos.objet))}
    ${ligne(infos.jours.length > 1 ? "Dates proposées" : "Date proposée", libelleJours(infos.jours).map(echapper).join("<br>"))}
  </table>`;
}

const paragraphes = (texte: string) =>
  texte
    .split(/\n{2,}/)
    .map((p) => `<p>${echapper(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const bouton = (lien: string, texte: string) =>
  `<p style="margin:18px 0;"><a href="${lien}" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-family:sans-serif;">${texte}</a></p>`;

async function envoyer(to: string | string[], subject: string, html: string) {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");
  const transporteur = nodemailer.createTransport({ service: "gmail", auth: { user: EMAIL_BUREAU, pass: motDePasse } });
  await transporteur.sendMail({ from: `OGEC Services <${EMAIL_BUREAU}>`, to, subject, html });
}

const sujet = (infos: InfosDemande, debut: string) => `${debut} — ${infos.client_nom}${infos.site ? ` — ${infos.site}` : ""}`;

export function messageParDefaut(nom: string, infos: InfosDemande, changement = false): string {
  return [
    nom ? `Bonjour ${nom},` : "Bonjour,",
    changement
      ? `Nous devons modifier la date de notre passage sur votre site ${infos.site} (${infos.objet}). Nous vous proposons désormais les dates indiquées ci-dessous, qui remplacent celles convenues précédemment.`
      : `Dans le cadre de : ${infos.objet}, nous vous proposons d'intervenir sur votre site ${infos.site} aux dates indiquées ci-dessous.`,
    "Merci de cliquer sur le bouton « Confirmer ou proposer une autre date » : vous pourrez confirmer ces dates en un clic, ou, si elles ne vous conviennent pas, nous proposer une autre date depuis la même page. Vous recevrez un accusé de réception dès votre réponse.",
    "Cordialement,\nOGEC Services",
  ].join("\n\n");
}

export async function envoyerDemande(p: { destinataire: string; message: string; lien: string; infos: InfosDemande }) {
  await envoyer(
    p.destinataire,
    sujet(p.infos, "Confirmation de notre passage"),
    `${paragraphes(p.message)}${tableau(p.infos)}${bouton(p.lien, "Confirmer ou proposer une autre date")}`,
  );
}

export async function envoyerCopieInformation(p: { copies: string[]; destinataireNom: string; infos: InfosDemande }) {
  if (p.copies.length === 0) return;
  await envoyer(
    p.copies,
    sujet(p.infos, "Pour information : passage proposé"),
    `<p>Bonjour,</p><p>Pour information, nous avons proposé à ${echapper(p.destinataireNom || "votre interlocuteur sur site")} les dates d'intervention ci-dessous. C'est lui qui les confirme.</p>${tableau(p.infos)}<p>Cordialement,<br>OGEC Services</p>`,
  );
}

export async function envoyerRelance(p: { destinataire: string; nom: string; lien: string; infos: InfosDemande; numero: number }) {
  await envoyer(
    p.destinataire,
    sujet(p.infos, p.numero > 1 ? "Rappel — confirmation de notre passage" : "Relance — confirmation de notre passage"),
    `<p>${p.nom ? `Bonjour ${echapper(p.nom)},` : "Bonjour,"}</p><p>Sauf erreur de notre part, nous n'avons pas encore reçu votre réponse à notre proposition de passage. Merci de confirmer ces dates, ou de nous en proposer d'autres, en cliquant sur le bouton ci-dessous.</p>${tableau(p.infos)}${bouton(p.lien, "Confirmer ou proposer une autre date")}<p>Cordialement,<br>OGEC Services</p>`,
  );
}

export async function envoyerAccuseClient(p: {
  destinataire: string;
  nom: string;
  infos: InfosDemande;
  reponse: "valide" | "autre_date";
  dateProposee?: string;
  moment?: string;
}) {
  const corps =
    p.reponse === "valide"
      ? "<p>Nous avons bien reçu votre confirmation. Notre passage est donc confirmé aux dates ci-dessous.</p>"
      : `<p>Nous avons bien reçu votre demande de changement de date${p.dateProposee ? ` (à partir du ${echapper(libelleJours([{ date: p.dateProposee, heure: null }])[0])}${p.moment ? `, ${p.moment === "matin" ? "le matin" : "l'après-midi"}` : ""})` : ""}. Nous revenons vers vous rapidement pour vous confirmer la nouvelle date.</p>`;
  await envoyer(
    p.destinataire,
    sujet(p.infos, p.reponse === "valide" ? "Passage confirmé" : "Demande de changement de date reçue"),
    `<p>${p.nom ? `Bonjour ${echapper(p.nom)},` : "Bonjour,"}</p>${corps}${p.reponse === "valide" ? tableau(p.infos) : ""}<p>Cordialement,<br>OGEC Services</p>`,
  );
}

export async function envoyerAlerteBureau(p: {
  infos: InfosDemande;
  evenement: "valide" | "autre_date" | "sans_reponse";
  destinataire: string;
  dateProposee?: string | null;
  moment?: string;
  commentaire?: string;
}) {
  const titre =
    p.evenement === "valide"
      ? "Créneau validé par le client"
      : p.evenement === "autre_date"
        ? "Le client propose une autre date"
        : "Sans réponse du client après 2 relances";
  const details =
    p.evenement === "autre_date"
      ? `<p><strong>Date proposée :</strong> à partir du ${echapper(libelleJours([{ date: p.dateProposee ?? "", heure: null }])[0])}${p.moment ? ` (${p.moment === "matin" ? "matin" : "après-midi"})` : ""}</p>${p.commentaire ? `<p><strong>Commentaire :</strong> ${echapper(p.commentaire)}</p>` : ""}<p>À traiter dans Planning → Planification (« Réponses clients à traiter »).</p>`
      : p.evenement === "sans_reponse"
        ? `<p>${echapper(p.destinataire)} n'a pas répondu malgré deux relances. L'intervention reste en attente de validation.</p>`
        : `<p>Confirmé par ${echapper(p.destinataire)}.</p>`;
  await envoyer(EMAIL_BUREAU, sujet(p.infos, titre), `<p><strong>${titre}</strong></p>${tableau(p.infos)}${details}`);
}

export async function envoyerConfirmationNouvelleDate(p: { destinataire: string; nom: string; infos: InfosDemande }) {
  await envoyer(
    p.destinataire,
    sujet(p.infos, "Nouvelle date confirmée"),
    `<p>${p.nom ? `Bonjour ${echapper(p.nom)},` : "Bonjour,"}</p><p>Nous avons le plaisir de vous confirmer notre passage à la date que vous nous avez proposée :</p>${tableau(p.infos)}<p>Cordialement,<br>OGEC Services</p>`,
  );
}

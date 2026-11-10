import nodemailer from "nodemailer";
import { formaterJourLong } from "./dates";

const GMAIL_USER = "ogecservices001@gmail.com";

type CreneauAnnonce = {
  date: string;
  heure_debut: string | null;
  client_nom: string;
  site: string;
  devis_id: string | null;
  visite_numero: number | null;
  visite_total: number | null;
  visite_annee: number | null;
};

function ligne(label: string, valeur: string): string {
  if (!valeur) return "";
  return `<tr><td style="background:#eef1e3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:200px;vertical-align:top;">${label}</td><td style="padding:8px 12px;border:1px solid #ccc;">${valeur}</td></tr>`;
}

/// Annonce au client des dates de notre prochain passage — site et dates
/// uniquement, jamais les noms des techniciens.
export async function envoyerAnnoncePassage(params: { destinataire: string; creneaux: CreneauAnnonce[] }): Promise<void> {
  const { destinataire, creneaux } = params;
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");

  const premier = creneaux[0];
  const nature =
    premier.devis_id
      ? "Prestation sur commande"
      : premier.visite_numero && premier.visite_total
        ? `Visite d'entretien ${premier.visite_numero} de ${premier.visite_total} — ${premier.visite_annee ?? ""}`
        : "Visite d'entretien";
  const dates = creneaux
    .map((c) => `${formaterJourLong(c.date)} ${c.date.slice(0, 4)}${c.heure_debut ? `, à partir de ${c.heure_debut.slice(0, 5)}` : ""}`)
    .join("<br>");

  const html = `
    <p>Bonjour,</p>
    <p>Nous vous informons de notre prochain passage sur votre site.</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      ${ligne("Client", [premier.client_nom, premier.site].filter(Boolean).join(" — "))}
      ${ligne("Objet", nature)}
      ${ligne(creneaux.length > 1 ? "Dates" : "Date", dates)}
    </table>
    <p>Pour toute question ou si ces dates ne vous conviennent pas, n'hésitez pas à nous contacter.</p>
    <p>Cordialement,<br>OGEC Services</p>
  `;

  const transporteur = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: motDePasse } });
  await transporteur.sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    to: destinataire,
    subject: `Prochain passage OGEC Services — ${premier.client_nom}${premier.site ? ` — ${premier.site}` : ""}`,
    html,
  });
}

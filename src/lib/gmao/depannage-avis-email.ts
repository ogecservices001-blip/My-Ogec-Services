import nodemailer from "nodemailer";

const GMAIL_USER = "ogecservices001@gmail.com";
const BUREAU_EMAIL = "ogec.services@orange.fr";

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ligne(label: string, valeur: string, style = ""): string {
  if (!valeur) return "";
  return `<tr><td style="background:#eef1e3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:220px;">${label}</td><td style="padding:8px 12px;border:1px solid #ccc;${style}">${valeur}</td></tr>`;
}

export type EquipementAvis = { nom: string; localisation: string; etats: string[] };

/// « En fonctionnement » ou « Hors fonctionnement », plus « Devis à faire »,
/// d'après les deux questions posées au technicien en fin d'équipement.
export function libelleEtatAvis(etats: string[]): string {
  const marche = etats.includes("hors_service") ? "Hors fonctionnement" : "En fonctionnement";
  return etats.includes("devis_a_etablir") ? `${marche} — Devis à faire` : marche;
}

/// Avis envoyé au client dès que le technicien transmet son BI de
/// dépannage, avant la vérification par le bureau : ni prix, ni heures, ni
/// compte rendu (ils partent avec le BI vérifié).
export async function envoyerAvisIntervention(params: {
  destinataires: string[];
  numero: string;
  nAffaire: string;
  clientNom: string;
  clientSite: string;
  nature: string;
  dateDemande: string;
  dateIntervention: string;
  equipements: EquipementAvis[];
}): Promise<void> {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");

  const lignesEquipements = params.equipements
    .map((e) => {
      const nom = [e.nom, e.localisation].filter(Boolean).map(echapper).join(" — ") || "Équipement";
      const etat = libelleEtatAvis(e.etats);
      const couleur = e.etats.includes("hors_service") ? "#c00" : "#2e7d32";
      return ligne(nom, `<strong style="color:${couleur};">${echapper(etat)}</strong>`);
    })
    .join("");

  const html = `
    <p>Bonjour,</p>
    <p>Notre technicien est intervenu suite à votre demande. Voici l'état constaté à l'issue de l'intervention.</p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      ${ligne("N° Intervention", `Int. N°${echapper(params.numero)}`)}
      ${ligne("N° affaire", echapper(params.nAffaire), "color:#c00;font-weight:bold;")}
      ${ligne("Client", echapper(params.clientNom))}
      ${ligne("Site", echapper(params.clientSite))}
      ${ligne("Nature de l'intervention", echapper(params.nature))}
      ${ligne("Date de la demande", echapper(params.dateDemande), "font-weight:bold;")}
      ${ligne("Date d'intervention", echapper(params.dateIntervention), "font-weight:bold;")}
      ${lignesEquipements}
    </table>
    <p>Le bon d'intervention vous sera adressé après vérification par nos services.</p>
    <p>Pour toute question, écrivez-nous à <strong>${BUREAU_EMAIL}</strong>.</p>
    <p>Cordialement,<br/>L'équipe OGEC Services</p>
  `;

  await nodemailer
    .createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: motDePasse } })
    .sendMail({
      from: `OGEC Services <${GMAIL_USER}>`,
      replyTo: BUREAU_EMAIL,
      to: params.destinataires,
      subject: `Intervention réalisée — Int. N°${params.numero} — ${params.clientSite || params.clientNom}`,
      html,
    });
}

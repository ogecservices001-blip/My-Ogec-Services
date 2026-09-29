import nodemailer from "nodemailer";

const GMAIL_USER = "ogecservices001@gmail.com";
const BUREAU_EMAIL = "ogec.services@orange.fr";

function ligne(label: string, valeur: string, style = ""): string {
  if (!valeur) return "";
  return `<tr><td style="background:#eef1e3;font-weight:bold;padding:8px 12px;border:1px solid #ccc;width:220px;">${label}</td><td style="padding:8px 12px;border:1px solid #ccc;${style}">${valeur}</td></tr>`;
}

/// Email de confirmation/prise en compte envoyé au client — reproduit
/// le tableau que le bureau composait déjà à la main pour répondre à
/// chaque demande (mêmes lignes, mêmes données), avec les infos déjà
/// saisies sur le ticket plutôt que ressaisies.
export async function envoyerConfirmationDepannage(params: {
  destinataire: string;
  numero: string;
  nAffaire: string;
  clientNom: string;
  clientSite: string;
  dateDemande: string;
  motif: string;
  lieuPanne: string;
  numeroDemandeClient: string;
  intervenant: string;
  dateInterventionPrevue: string;
  codePostal: string;
  commune: string;
  adresse: string;
  interlocuteurSite: string;
  tel1: string;
  tel2: string;
  informationComplementaire: string;
}): Promise<void> {
  const motDePasse = process.env.GMAIL_APP_PASSWORD;
  if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");

  const html = `
    <p>Bonjour,</p>
    <p>Suite à votre demande d'intervention : ci-dessous la prise en compte et la planification de l'intervention.<br/>
    Les coordonnées de l'intervenant vous sont communiquées exclusivement dans le cadre de cette demande.<br/>
    Toutes autres demandes sont à effectuées <strong style="color:#c00;">exclusivement par courriel à l'adresse "${BUREAU_EMAIL}"</strong></p>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      ${ligne("N° Intervention", `Int. N°${params.numero}`)}
      ${ligne("N'affaire", params.nAffaire, "color:#c00;font-weight:bold;")}
      ${ligne("Clients", params.clientNom)}
      ${ligne("Sites", params.clientSite)}
      ${ligne("Date Demande", params.dateDemande, "font-weight:bold;")}
      ${ligne("Motif de l'appel", params.motif)}
      ${ligne("Lieu de la panne", params.lieuPanne, "color:#06c;font-weight:bold;")}
      ${ligne("N° Demande Client", params.numeroDemandeClient)}
      ${ligne("Intervenant", params.intervenant)}
      ${ligne("Date intervention prévue", params.dateInterventionPrevue, "font-weight:bold;")}
      ${ligne("Code Postal", params.codePostal)}
      ${ligne("Commune", params.commune)}
      ${ligne("Adresse", params.adresse)}
      ${ligne("Interlocuteur Sur site", params.interlocuteurSite, "font-weight:bold;")}
      ${ligne("N° tel 1 client", params.tel1, "font-weight:bold;")}
      ${ligne("N° tel 2 client", params.tel2, "font-weight:bold;")}
      ${ligne("Information Complémentaire", params.informationComplementaire)}
    </table>
  `;

  const transporteur = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: motDePasse },
  });

  await transporteur.sendMail({
    from: `OGEC Services <${GMAIL_USER}>`,
    to: params.destinataire,
    subject: `${params.motif} — Int. N°${params.numero}`,
    html,
  });
}

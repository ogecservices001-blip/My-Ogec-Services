import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { URL_APPLI } from "@/lib/planning/validation";
import { contactsDuSite } from "@/lib/espace-client/contacts";
import { messageErreur, signalerIncident } from "@/lib/incidents";

const GMAIL_USER = "ogecservices001@gmail.com";
const BUREAU_EMAIL = "ogec.services@orange.fr";

/// Validation d'un BI d'entretien : les contacts du site ouverts à « Mon
/// contrat OGEC » sont prévenus que le rapport de visite est disponible.
/// Une seule fois par BI. Ne lève jamais d'erreur.
export async function notifierRapportDisponible(biId: string): Promise<void> {
  const admin = createAdminClient();
  try {
    const { data: bi } = await admin
      .from("bons_intervention")
      .select("id, numero, site_id, visite_numero, visite_total, visite_annee, date_fin, date_intervention, rapport_client_notifie_le")
      .eq("id", biId)
      .single();
    if (!bi?.site_id || bi.rapport_client_notifie_le) return;
    const [{ data: site }, { data: acces }] = await Promise.all([
      admin.from("sites").select("*").eq("id", bi.site_id).single(),
      admin.from("acces_clients").select("email").eq("site_id", bi.site_id).is("revoque_le", null),
    ]);
    if (!site) return;
    const surLaFiche = new Map(contactsDuSite(site as Record<string, unknown>).map((c) => [c.email, c]));
    const destinataires = (acces ?? []).map((a) => surLaFiche.get(a.email)).filter((c) => c !== undefined);
    if (destinataires.length === 0) return;

    const motDePasse = process.env.GMAIL_APP_PASSWORD;
    if (!motDePasse) throw new Error("Envoi email non configuré (GMAIL_APP_PASSWORD manquant).");
    const visite = bi.visite_numero ? `visite ${bi.visite_numero}${bi.visite_total ? ` de ${bi.visite_total}` : ""}${bi.visite_annee ? ` — ${bi.visite_annee}` : ""}` : "visite d'entretien";
    const lien = `${URL_APPLI.replace(/\/$/, "")}/mon-contrat/sites/${bi.site_id}`;
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: motDePasse } });
    for (const c of destinataires) {
      await transport.sendMail({
        from: `OGEC Services <${GMAIL_USER}>`,
        replyTo: BUREAU_EMAIL,
        to: c.email,
        subject: `Votre rapport de visite est disponible — ${site.site || site.nom}`,
        html: `
          <p>Bonjour${c.nom ? ` ${c.nom}` : ""},</p>
          <p>Le rapport de votre ${visite} (${bi.date_fin || bi.date_intervention}) pour le site <strong>${site.site || site.nom}</strong> est disponible dans votre espace <strong>Mon contrat OGEC</strong>.</p>
          <p><a href="${lien}" style="display:inline-block;padding:11px 20px;background:#4f9a41;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Consulter mon rapport</a></p>
          <p>Cordialement,<br/>L'équipe OGEC Services</p>
        `,
      });
    }
    await admin.from("bons_intervention").update({ rapport_client_notifie_le: new Date().toISOString() }).eq("id", biId);
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: "Mon contrat OGEC : avis « rapport disponible » non envoyé",
      detail: messageErreur(e),
      objetType: "bi",
      objetId: biId,
      lien: `/bi/${biId}`,
    });
  }
}

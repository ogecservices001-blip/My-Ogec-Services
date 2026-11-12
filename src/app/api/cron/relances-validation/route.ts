import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { joursOuvresEcoules, lienValidation } from "@/lib/planning/validation";
import { envoyerAlerteBureau, envoyerRelance, type InfosDemande, type JourDemande } from "@/lib/planning/validation-email";

const DELAI_JOURS_OUVRES = 3;

/// Relances des demandes de validation client sans réponse, lancée chaque
/// matin par Vercel Cron. Idempotente : chaque relance est datée en base et
/// n'est jamais renvoyée, un appel en trop ne fait rien.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  }
  const admin = createAdminClient();
  const maintenant = new Date();
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const [{ data: demandes }, { data: feries }] = await Promise.all([
    admin.from("demandes_validation_client").select("*").eq("statut", "attente"),
    admin.from("jours_feries").select("date"),
  ]);
  const joursFeries = (feries ?? []).map((f) => f.date);
  const bilan = { relance1: 0, relance2: 0, sansReponse: 0, erreurs: 0 };

  for (const d of demandes ?? []) {
    const infos: InfosDemande = { client_nom: d.client_nom, site: d.site, objet: d.objet, jours: (d.jours as JourDemande[]) ?? [] };
    const derniere = infos.jours[infos.jours.length - 1]?.date ?? "";
    if (derniere && derniere < aujourdhui) continue;
    const ecoules = (depuis: string) => joursOuvresEcoules(new Date(depuis), maintenant, joursFeries);
    try {
      if (!d.relance1_le && ecoules(d.envoye_le) >= DELAI_JOURS_OUVRES) {
        await envoyerRelance({ destinataire: d.destinataire_email, nom: d.destinataire_nom, lien: lienValidation(d.token), infos, numero: 1 });
        await admin.from("demandes_validation_client").update({ relance1_le: maintenant.toISOString() }).eq("id", d.id);
        bilan.relance1++;
      } else if (d.relance1_le && !d.relance2_le && ecoules(d.relance1_le) >= DELAI_JOURS_OUVRES) {
        await envoyerRelance({ destinataire: d.destinataire_email, nom: d.destinataire_nom, lien: lienValidation(d.token), infos, numero: 2 });
        await admin.from("demandes_validation_client").update({ relance2_le: maintenant.toISOString() }).eq("id", d.id);
        bilan.relance2++;
      } else if (d.relance2_le && !d.sans_reponse_le && ecoules(d.relance2_le) >= DELAI_JOURS_OUVRES) {
        await envoyerAlerteBureau({
          infos,
          evenement: "sans_reponse",
          destinataire: [d.destinataire_nom, d.destinataire_email].filter(Boolean).join(" — "),
        });
        await admin.from("demandes_validation_client").update({ sans_reponse_le: maintenant.toISOString() }).eq("id", d.id);
        bilan.sansReponse++;
      }
    } catch {
      bilan.erreurs++;
    }
  }
  return NextResponse.json(bilan);
}

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { historiqueComplet, prochaineActionAuto } from "@/lib/planning/validation-historique";
import type { DateProposee, JourDemande } from "@/lib/planning/periode";
import { PointRdvVue, type DemandeRdv, type EtatRdv } from "./vue";

export default async function PointRdvClientPage() {
  await requireAdmin();
  const supabase = await createClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [{ data: demandes }, { data: feries }] = await Promise.all([
    supabase.from("demandes_validation_client").select("*").order("envoye_le", { ascending: false }).limit(1000),
    supabase.from("jours_feries").select("date").gte("date", aujourdhui),
  ]);
  const joursFeries = (feries ?? []).map((f) => f.date);

  const lignes: DemandeRdv[] = [];
  for (const d of demandes ?? []) {
    const jours = (d.jours as JourDemande[]) ?? [];
    const derniere = jours[jours.length - 1]?.date ?? "";
    let etat: EtatRdv | null = null;
    if (d.statut === "autre_date" && !d.traite_le) etat = "a_traiter";
    else if (d.statut === "remplacee" && (d.motif_remplacement === "modification" || d.motif_remplacement === "replanification")) etat = "a_reproposer";
    else if (d.statut === "attente") etat = "attente";
    else if (d.statut === "valide") etat = derniere >= aujourdhui ? "valide" : "passe";
    if (!etat) continue;
    const proposees = (d.dates_proposees as DateProposee[] | null) ?? [];
    lignes.push({
      id: d.id,
      etat,
      client_nom: d.client_nom,
      site: d.site,
      objet: d.objet,
      jours,
      proposees: proposees.length ? proposees : d.date_proposee ? [{ date: d.date_proposee, moment: d.moment }] : [],
      commentaire: d.commentaire,
      destinataire: [d.destinataire_nom, d.destinataire_email].filter(Boolean).join(" — "),
      envoyeLe: d.envoye_le,
      expiree: Boolean(derniere) && derniere < aujourdhui,
      historique: historiqueComplet(d),
      prochaine: d.statut === "attente" && !(derniere && derniere < aujourdhui) ? prochaineActionAuto(d, joursFeries) : null,
      sansReponse: Boolean(d.sans_reponse_le),
      premierCreneauId: (d.creneau_ids as string[])[0] ?? "",
    });
  }

  return <PointRdvVue demandes={lignes} />;
}

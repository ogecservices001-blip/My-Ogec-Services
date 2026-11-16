import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { historiqueComplet, prochaineActionAuto } from "@/lib/planning/validation-historique";
import { ajouterJours } from "@/lib/planning/dates";
import type { DateProposee, JourDemande } from "@/lib/planning/periode";
import { PointRdvVue, type DemandeRdv, type EtatRdv } from "./vue";

const JOURS_AVANT_ARCHIVE = 7;
const isoDepuisFr = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/// Une demande est archivée (jamais effacée) 7 jours après le BI de son
/// intervention, ou dès qu'une demande plus récente la remplace. Une date
/// passée sans BI reste visible : intervention oubliée ou BI pas encore fait.
export default async function PointRdvClientPage() {
  await requireAdmin();
  const supabase = await createClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [{ data: demandes }, { data: feries }] = await Promise.all([
    supabase.from("demandes_validation_client").select("*").order("envoye_le", { ascending: false }).limit(1000),
    supabase.from("jours_feries").select("date").gte("date", aujourdhui),
  ]);
  const joursFeries = (feries ?? []).map((f) => f.date);

  const creneauIds = [...new Set((demandes ?? []).flatMap((d) => (d.creneau_ids as string[]) ?? []))];
  const { data: bons } = creneauIds.length
    ? await supabase
        .from("bons_intervention")
        .select("id, numero, creneau_id, date_intervention, date_fin, date_debut")
        .in("creneau_id", creneauIds)
        .neq("statut", "brouillon")
    : { data: [] };
  const biParCreneau = new Map((bons ?? []).map((b) => [b.creneau_id as string, b]));

  const lignes: DemandeRdv[] = [];
  for (const d of demandes ?? []) {
    const jours = (d.jours as JourDemande[]) ?? [];
    const derniere = jours[jours.length - 1]?.date ?? "";
    const bi = ((d.creneau_ids as string[]) ?? []).map((id) => biParCreneau.get(id)).find(Boolean);
    const dateBi = bi ? isoDepuisFr(bi.date_fin || bi.date_intervention || bi.date_debut) || derniere : "";
    const remplaceeParNouvelle = d.statut === "remplacee" && !["modification", "replanification"].includes(d.motif_remplacement);

    let etat: EtatRdv | null = null;
    if (d.statut === "autre_date" && !d.traite_le) etat = "a_traiter";
    else if (d.statut === "remplacee") etat = remplaceeParNouvelle ? "remplacee" : "a_reproposer";
    else if (d.statut === "attente") etat = "attente";
    else if (d.statut === "valide") etat = "valide";
    if (!etat) continue;

    const archivee = remplaceeParNouvelle || (Boolean(dateBi) && ajouterJours(dateBi, JOURS_AVANT_ARCHIVE) <= aujourdhui);
    const proposees = (d.dates_proposees as DateProposee[] | null) ?? [];
    lignes.push({
      id: d.id,
      siteId: d.site_id ?? "",
      etat,
      archivee,
      bi: bi ? { id: bi.id, numero: bi.numero } : null,
      datePasseeSansBi: !bi && Boolean(derniere) && derniere < aujourdhui && etat !== "remplacee",
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

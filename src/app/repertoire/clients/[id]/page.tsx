import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site } from "@/lib/types";

function Section({
  titre,
  champs,
}: {
  titre: string;
  champs: [string, string][];
}) {
  return (
    <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
        {titre}
      </h2>
      <dl className="space-y-2">
        {champs.map(([label, valeur]) => (
          <div key={label} className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="text-sm font-medium text-slate-600 sm:w-56 sm:shrink-0">
              {label}
            </dt>
            <dd className={valeur ? "text-sm text-slate-900" : "text-sm text-slate-400"}>
              {valeur || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const { data: s } = await supabase
    .from("sites_view")
    .select("*")
    .eq("id", id)
    .single();

  if (!s) notFound();
  const site = s as Site;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">{site.nom}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {site.site} {site.hors_contrat && "· Hors contrat"}
      </p>

      <Section
        titre="Identité & Site"
        champs={[
          ["N° Affaire", site.n_affaire],
          ["Commune", site.commune],
          ["Code postal", site.code_postal],
          ["Adresse", site.adresse],
          ["Complément d'adresse", site.complement_adresse],
        ]}
      />
      <Section
        titre="Accès & Sécurité"
        champs={[
          ["EPI spécifique", site.epi_specifique],
          ["Habilitation spécifique", site.habilitation_specifique],
          ["Moyen d'accès", site.moyen_acces],
          ["Jour d'accès", site.jour_acces],
          ["Heures d'accès", site.heures_acces],
          ["Délai d'intervention", site.delai_intervention],
        ]}
      />
      <Section
        titre="Contacts & Suivi"
        champs={[
          ["Interlocuteur site", site.interlocuteur_site],
          ["Tél fixe interlocuteur", site.tel_fixe_interlocuteur_site],
          ["Portable interlocuteur", site.portable_interlocuteur_site],
          ["Courriel interlocuteur", site.courriel_interlocuteur_site],
          ["Fréq. entretien / an", site.freq_entretien_an],
          ["Interlocuteur tiers", site.interlocuteur_tiers],
          ["Tél fixe tiers", site.tel_fixe_tiers],
          ["Portable tiers", site.portable_tiers],
          ["Courriel tiers", site.courriel_tiers],
          ["Remarques libres", site.remarques_libres],
        ]}
      />

      {isAdmin && (
        <>
          <Section
            titre="Heures & Tarifs"
            champs={[
              ["Nb heures vendues", site.nb_heures_vendues],
              ["Nb heures vendues assistant", site.nb_heures_vendues_assistant],
              ["Qté heures programmées", site.qte_heures_programmees],
              ["Qté heures restantes", site.qte_heures_restantes],
              ["Taux horaire régie", site.taux_horaire_regie],
              ["Taux horaire vendu", site.taux_horaire_vendu],
              ["Forfait déplacement", site.forfait_deplacement],
            ]}
          />
          <Section
            titre="Contrat"
            champs={[
              ["Date offre", site.date_offre],
              ["Date prise d'effet contrat", site.date_prise_effet_contrat],
              ["Date fin contrat", site.date_fin_contrat],
              ["Durée contrat", site.duree_contrat],
              ["Montant contrat AV", site.montant_contrat_av],
              ["Référence offre OGS", site.reference_offre_ogs],
              ["Responsable contrat", site.responsable_contrat],
              ["Tél fixe responsable", site.tel_fixe_responsable],
              ["Portable responsable", site.portable_responsable],
              ["Courriel responsable", site.courriel_responsable],
            ]}
          />
          <Section
            titre="Facturation"
            champs={[
              ["Adresse facturation", site.adresse_facturation],
              ["Code postal facturation", site.code_postal_facturation],
              ["Commune facturation", site.commune_facturation],
              ["Complément adresse facturation", site.complement_adresse_facturation],
              ["Interlocuteur facturation", site.interlocuteur_facturation],
              ["Tél fixe interlocuteur facturation", site.tel_fixe_interlocuteur_facturation],
              ["Portable interlocuteur facturation", site.portable_interlocuteur_facturation],
              ["Courriel interlocuteur facturation", site.courriel_interlocuteur_facturation],
              ["Fréq. facturation annuelle", site.freq_factu_annuelle],
            ]}
          />
          <Section
            titre="Révision & Indices"
            champs={[
              ["Date révision", site.date_revision],
              ["Formule révision entretien", site.formule_revision_entretien],
              ["Formule révision dépannage", site.formule_revision_depannage],
              ["Date indice S", site.date_indice_s],
              ["Valeur indice S", site.valeur_indice_s],
              ["Date indice Ch", site.date_indice_ch],
              ["Valeur indice Ch", site.valeur_indice_ch],
              ["Date indice S'", site.date_indice_s_prime],
              ["Valeur indice S'", site.valeur_indice_s_prime],
              ["Date indice Ch'", site.date_indice_ch_prime],
              ["Valeur indice Ch'", site.valeur_indice_ch_prime],
              ["Montant contrat AV révisé", site.montant_contrat_av_revise],
              ["Taux horaire révisé", site.taux_horaire_revise],
              ["Forfait déplacement révisé", site.forfait_deplacement_revise],
              ["Modif RI ou BG", site.modif_ri_ou_bg],
            ]}
          />
        </>
      )}
    </div>
  );
}

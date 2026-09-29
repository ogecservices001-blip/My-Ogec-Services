import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  IdCard,
  ShieldCheck,
  Users,
  Clock,
  FileText,
  Receipt,
  TrendingUp,
  Pencil,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { formaterDate } from "@/lib/format";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import type { Site } from "@/lib/types";
import { supprimerSite } from "../actions";

function Section({
  titre,
  icone: Icone,
  niveau,
  champs,
}: {
  titre: string;
  icone: LucideIcon;
  niveau: "technicien" | "admin";
  champs: [string, string][];
}) {
  const teintes =
    niveau === "technicien"
      ? {
          bordure: "border-l-4 border-l-brand-green/40",
          entete: "bg-green-50/50",
          icone: "text-brand-green-dark",
        }
      : {
          bordure: "border-l-4 border-l-orange-300",
          entete: "bg-orange-50/50",
          icone: "text-orange-600",
        };

  return (
    <div
      className={`mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ${teintes.bordure}`}
    >
      <div
        className={`flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 ${teintes.entete}`}
      >
        <Icone className={`h-3.5 w-3.5 ${teintes.icone}`} strokeWidth={2.25} />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {titre}
        </h2>
      </div>
      <dl>
        {champs.map(([label, valeur], i) => (
          <div
            key={label}
            className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-2 ${
              i > 0 ? "border-t border-slate-50" : ""
            }`}
          >
            <dt className="text-[13px] text-slate-500 sm:w-60 sm:shrink-0">
              {label}
            </dt>
            <dd
              className={
                valeur
                  ? "text-sm font-medium text-slate-900"
                  : "text-sm text-slate-300"
              }
            >
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
      <Link
        href="/repertoire/clients"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {site.nom}
          </h1>
          <p className="text-lg font-semibold text-blue-600">{site.site}</p>
        </div>
        {site.hors_contrat && (
          <span className="mt-1 shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
            Hors contrat
          </span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/repertoire/clients/${id}/equipements`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Wrench className="h-4 w-4" strokeWidth={2} />
          Équipements Clients
        </Link>
        {isAdmin && (
          <>
            <Link
              href={`/repertoire/clients/${id}/modifier`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} />
              Modifier
            </Link>
            <BoutonSupprimer
              action={supprimerSite.bind(null, id)}
              confirmation={`Supprimer définitivement le site "${site.site}" de ${site.nom} ? Cette action est irréversible.`}
              redirectTo="/repertoire/clients"
            />
          </>
        )}
      </div>

      <Section
        titre="Identité & Site"
        icone={IdCard}
        niveau="technicien"
        champs={[
          ["N°Affaire", site.n_affaire],
          ["Code Postal", site.code_postal],
          ["Commune", site.commune],
          ["Adresse", site.adresse],
          ["Complément d'adresse", site.complement_adresse],
        ]}
      />
      <Section
        titre="Accès & Sécurité"
        icone={ShieldCheck}
        niveau="technicien"
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
        icone={Users}
        niveau="technicien"
        champs={[
          ["Interlocuteur site", site.interlocuteur_site],
          ["Tel Fixe interlocuteur site", site.tel_fixe_interlocuteur_site],
          ["Portable interlocuteur site", site.portable_interlocuteur_site],
          ["Courriel interlocuteur site", site.courriel_interlocuteur_site],
          ["Fréq. entretien / an", site.freq_entretien_an],
          ["Interlocuteur Tiers", site.interlocuteur_tiers],
          ["Tel Fixe Tiers", site.tel_fixe_tiers],
          ["Portable Tiers", site.portable_tiers],
          ["Courriel Tiers", site.courriel_tiers],
          ["Remarques libres", site.remarques_libres],
        ]}
      />

      {isAdmin && (
        <>
          <Section
            titre="Heures & Tarifs"
            icone={Clock}
            niveau="admin"
            champs={[
              ["Nb Heures vendues", site.nb_heures_vendues],
              ["Nb Heures vendues assistant", site.nb_heures_vendues_assistant],
              ["Qté heures programmées", site.qte_heures_programmees],
              ["Qté heures restantes", site.qte_heures_restantes],
              ["Taux horaire régie", site.taux_horaire_regie],
              ["Taux horaire vendu", site.taux_horaire_vendu],
              ["Forfait déplacement", site.forfait_deplacement],
            ]}
          />
          <Section
            titre="Contrat"
            icone={FileText}
            niveau="admin"
            champs={[
              ["Date de l'offre", formaterDate(site.date_offre)],
              ["Date de prise d'effet", formaterDate(site.date_prise_effet_contrat)],
              ["Date de fin de contrat", formaterDate(site.date_fin_contrat)],
              ["Durée", site.duree_contrat],
              ["Montant Contrat + AV", site.montant_contrat_av],
              ["Référence offre OGS", site.reference_offre_ogs],
              ["Responsable contrat", site.responsable_contrat],
              ["Tel Fixe responsable", site.tel_fixe_responsable],
              ["Portable responsable", site.portable_responsable],
              ["Courriel responsable", site.courriel_responsable],
            ]}
          />
          <Section
            titre="Facturation"
            icone={Receipt}
            niveau="admin"
            champs={[
              ["Adresse facturation", site.adresse_facturation],
              ["Code Postal facturation", site.code_postal_facturation],
              ["Commune facturation", site.commune_facturation],
              ["Complément d'adresse facturation", site.complement_adresse_facturation],
              ["Interlocuteur facturation", site.interlocuteur_facturation],
              ["Tel Fixe interlocuteur facturation", site.tel_fixe_interlocuteur_facturation],
              ["Portable interlocuteur facturation", site.portable_interlocuteur_facturation],
              ["Courriel interlocuteur facturation", site.courriel_interlocuteur_facturation],
              ["Fréq. facturation annuelle", site.freq_factu_annuelle],
            ]}
          />
          <Section
            titre="Révision & Indices"
            icone={TrendingUp}
            niveau="admin"
            champs={[
              ["Date de révision", formaterDate(site.date_revision)],
              ["Formule révision entretien", site.formule_revision_entretien],
              ["Formule révision dépannage", site.formule_revision_depannage],
              ["Date Indice S", formaterDate(site.date_indice_s)],
              ["Valeur indice S", site.valeur_indice_s],
              ["Date Indice CH", formaterDate(site.date_indice_ch)],
              ["Valeur indice CH", site.valeur_indice_ch],
              ["Date Indice S°", formaterDate(site.date_indice_s_prime)],
              ["Valeur indice S°", site.valeur_indice_s_prime],
              ["Date Indice CH°", formaterDate(site.date_indice_ch_prime)],
              ["Valeur indice CH°", site.valeur_indice_ch_prime],
              ["Montant Contrat+AV révisé", site.montant_contrat_av_revise],
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

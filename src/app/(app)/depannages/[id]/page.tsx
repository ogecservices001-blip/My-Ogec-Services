import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { StatutBadge } from "@/components/bi/statut-badge";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";
import { LABEL_STATUT_DEVIS, TEINTE_STATUT_DEVIS } from "@/app/(app)/devis/statut";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

function formaterDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formaterDelaiEntre(debut: string, fin: string | null): string {
  if (!fin) return "";
  const heures = (new Date(fin).getTime() - new Date(debut).getTime()) / 3_600_000;
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 24) return `${heures.toFixed(1)} h`;
  return `${Math.floor(heures / 24)} j ${Math.round(heures % 24)} h`;
}

export default async function DepannageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOuAccueil();
  const { id } = await params;

  const supabase = await createClient();
  const { data: demande } = await supabase.from("demandes_depannage").select("*").eq("id", id).single();
  if (!demande) notFound();

  const [{ data: intervenant }, { data: bon }, { data: site }, devisEnCoursParEquipement] = await Promise.all([
    demande.intervenant_id
      ? supabase.from("profiles").select("name, portable").eq("id", demande.intervenant_id).single()
      : Promise.resolve({ data: null }),
    demande.bon_intervention_id
      ? supabase.from("bons_intervention").select("id, numero, statut").eq("id", demande.bon_intervention_id).single()
      : Promise.resolve({ data: null }),
    demande.site_id
      ? supabase
          .from("sites")
          .select(
            "interlocuteur_site, courriel_interlocuteur_site, interlocuteur_tiers, courriel_tiers, interlocuteur_facturation, courriel_interlocuteur_facturation, responsable_contrat, courriel_responsable",
          )
          .eq("id", demande.site_id)
          .single()
      : Promise.resolve({ data: null }),
    chargerDevisEnCoursParEquipement(),
  ]);
  const devisEnCours = demande.equipement_id ? (devisEnCoursParEquipement[demande.equipement_id] ?? []) : [];

  // Le nom du demandeur n'est jamais saisi tel quel (juste son email) —
  // on le retrouve en rapprochant l'email avec les contacts connus du
  // site (Répertoire).
  const contactsSite: [string, string][] = site
    ? [
        [site.interlocuteur_site, site.courriel_interlocuteur_site],
        [site.interlocuteur_tiers, site.courriel_tiers],
        [site.interlocuteur_facturation, site.courriel_interlocuteur_facturation],
        [site.responsable_contrat, site.courriel_responsable],
      ]
    : [];
  const demandeurNom = demande.email
    ? (contactsSite.find(([, courriel]) => courriel && courriel.toLowerCase() === demande.email.toLowerCase())?.[0] ?? "")
    : "";
  const demandeurLabel = demande.email
    ? [demandeurNom, demande.email].filter(Boolean).join(" — ")
    : "Créé par le bureau";

  const infos: [string, string][] = [
    ["N°", demande.numero],
    ["Client — Site", [demande.client_nom, demande.client_site].filter(Boolean).join(" — ")],
    ["Demandé par", demandeurLabel],
    ["Équipement", demande.equipement_nom],
    ["Lieu de la panne", demande.lieu_panne],
    ["Créé le", formaterDateHeure(demande.date_creation)],
    ["Traité le", demande.date_traitement ? formaterDateHeure(demande.date_traitement) : ""],
    ["Délai de traitement", formaterDelaiEntre(demande.date_creation, demande.date_traitement)],
    ["Date d'intervention prévue", demande.date_intervention_prevue ? formaterDate(demande.date_intervention_prevue) : ""],
    ["Réf. demande client", demande.numero_demande_client],
    ["Technicien assigné", intervenant?.name ?? ""],
  ];

  return (
    <div>
      <Link
        href="/depannages/traitees"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-bold text-slate-900">N°{demande.numero}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-700">
          {[demande.client_nom, demande.client_site].filter(Boolean).join(" — ")}
        </p>
        <p className="mt-1 text-sm text-slate-500">Demandé par : {demandeurLabel}</p>
        <span
          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
            demande.statut === "traitee" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {demande.statut === "traitee" ? "Traitée" : "Nouvelle"}
        </span>
      </div>

      <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Informations du dépannage
        </p>
        <dl className="grid gap-x-6 gap-y-0.5 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          {infos.map(([label, valeur]) => (
            <div key={label} className="flex items-baseline gap-1.5 py-1 text-sm">
              <dt className="shrink-0 text-slate-400">{label} :</dt>
              <dd className={`min-w-0 truncate font-medium ${valeur ? "text-slate-800" : "text-slate-300"}`}>
                {valeur || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Motif</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{demande.message || "—"}</p>
        </div>

        {intervenant?.portable && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Intervenant</h2>
            <p className="text-sm font-semibold text-slate-800">{intervenant.name}</p>
            <a
              href={`tel:${intervenant.portable}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-green-dark hover:underline"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={2} />
              {intervenant.portable}
            </a>
          </div>
        )}

        {bon && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Bon d&apos;intervention</h2>
            <Link
              href={`/bi/${bon.id}`}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
            >
              <span className="font-semibold text-slate-900">{bon.numero || "BI (brouillon)"}</span>
              <StatutBadge statut={bon.statut} />
            </Link>
          </div>
        )}

        {devisEnCours.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-900">Devis en cours sur cet équipement</h2>
            <ul className="space-y-1.5">
              {devisEnCours.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-semibold text-slate-900">{d.numero}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${TEINTE_STATUT_DEVIS[d.statut]}`}>
                    {LABEL_STATUT_DEVIS[d.statut]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

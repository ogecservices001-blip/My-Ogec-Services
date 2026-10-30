import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { FilAjouter } from "@/components/fil-extra-context";
import { StatutBadge } from "@/components/bi/statut-badge";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";
import { LABEL_STATUT_DEVIS } from "@/app/(app)/devis/statut";
import { telInternational } from "@/lib/format";

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
  // Si l'email saisi matche un contact précis du site, on le préfère ;
  // sinon le contact principal du site (interlocuteur_site) reste la
  // meilleure info disponible sur "qui, chez le client" — même quand la
  // demande a été créée par le bureau (appel téléphonique, etc.).
  const demandeurNom =
    (demande.email
      ? contactsSite.find(([, courriel]) => courriel && courriel.toLowerCase() === demande.email.toLowerCase())?.[0]
      : undefined) ||
    site?.interlocuteur_site ||
    "";
  const demandeurLabel = [demandeurNom, demande.email].filter(Boolean).join(" — ") || "Créé par le bureau";

  const infos: [string, string][] = [
    ["Client — Site", [demande.client_nom, demande.client_site].filter(Boolean).join(" — ")],
    ["Demandé par", demandeurLabel],
    ["Équipement", demande.equipement_nom],
    ["Lieu de la panne", demande.lieu_panne],
    ["Motif", demande.message],
    ["Créé le", formaterDateHeure(demande.date_creation)],
    ["Traité le", demande.date_traitement ? formaterDateHeure(demande.date_traitement) : ""],
    ["Délai de traitement", formaterDelaiEntre(demande.date_creation, demande.date_traitement)],
    ["Date d'intervention prévue", demande.date_intervention_prevue ? formaterDate(demande.date_intervention_prevue) : ""],
    ["Réf. demande client", demande.numero_demande_client],
    ["Technicien assigné", intervenant?.name ?? ""],
  ];

  return (
    <div>
      <FilAjouter
        maillons={[{ nom: `N°${demande.numero}` }]}
        sousMenu={
          demande.statut === "traitee"
            ? { nom: "Dépannages traités", href: "/depannages/traitees" }
            : { nom: "Dépannages en cours", href: "/depannages" }
        }
      />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dépannage N°{demande.numero}</h1>
          <p className="text-sm font-semibold text-slate-700">
            {[demande.client_nom, demande.client_site].filter(Boolean).join(" — ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            demande.statut === "traitee" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {demande.statut === "traitee" ? "Traitée" : "Nouvelle"}
        </span>
      </div>

      {bon && (
        <p className="mb-3 text-sm text-slate-600">
          Bon d&apos;intervention :{" "}
          <Link href={`/bi/${bon.id}`} className="font-semibold text-violet-700 hover:underline">
            {bon.numero || "BI (brouillon)"}
          </Link>{" "}
          <StatutBadge statut={bon.statut} />
        </p>
      )}

      <dl>
        {infos.map(([label, valeur], i) => (
          <div key={label} className={`flex flex-col gap-0.5 px-0 py-2.5 sm:flex-row sm:items-baseline sm:gap-2 ${i > 0 ? "border-t border-slate-50" : "border-t border-slate-100"}`}>
            <dt className="text-[13px] text-slate-500 sm:w-60 sm:shrink-0">{label}</dt>
            <dd className={valeur ? "text-sm font-medium text-slate-900" : "text-sm text-slate-300"}>{valeur || "—"}</dd>
          </div>
        ))}
      </dl>

      {intervenant?.portable && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{intervenant.name}</span> —{" "}
          <a href={`tel:${telInternational(intervenant.portable)}`} className="inline-flex items-center gap-1 text-brand-green-dark hover:underline">
            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            {telInternational(intervenant.portable)}
          </a>
        </p>
      )}

      {devisEnCours.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Devis en cours sur cet équipement</h2>
          {devisEnCours.map((d, i) => (
            <p key={i} className="text-sm text-slate-800">
              {d.numero} — {LABEL_STATUT_DEVIS[d.statut]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

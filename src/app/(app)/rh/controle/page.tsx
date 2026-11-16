import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculerPointage, journeesIncompletes } from "@/lib/rh/pointage";
import { lundiDeLaSemaine, formaterJourLong } from "@/lib/planning/dates";
import { ChoixMois } from "./choix-mois";

function Bloc({ titre, nb, children }: { titre: string; nb: number; children: React.ReactNode }) {
  return (
    <div className={`mb-4 rounded-2xl p-4 shadow-sm ${nb ? "bg-white" : "bg-green-50"}`}>
      <p className={`mb-2 flex items-center gap-1.5 text-sm font-bold ${nb ? "text-amber-800" : "text-green-800"}`}>
        {nb ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {titre} ({nb})
      </p>
      {nb ? children : <p className="text-sm text-green-800">Rien à signaler.</p>}
    </div>
  );
}

/// Contrôle du mois, port des macros A (journées incomplètes) et B (communes).
export default async function ControlePage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin();
  const { mois: brut } = await searchParams;
  const mois = brut && /^\d{4}-(0[1-9]|1[0-2])$/.test(brut) ? brut : new Date().toISOString().slice(0, 7);
  const supabase = await createClient();
  const d = await calculerPointage(supabase, mois);
  const anomalies = journeesIncompletes(d, mois, new Date().toISOString().slice(0, 10));
  const sansFiche = d.techniciens.filter((t) => !t.salarie);
  const rien = anomalies.length + d.sitesSansCommune.length + d.communesHorsBareme.length + sansFiche.length === 0;


  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Contrôle du mois</h1>
          <p className="text-sm text-slate-500">
            À corriger avant de clôturer le{" "}
            <Link href={`/rh/pointage?mois=${mois}`} className="font-semibold text-brand-green-dark underline">
              pointage
            </Link>
            .
          </p>
        </div>
        <ChoixMois mois={mois} />
      </div>
      {rien && <p className="mb-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800">Aucune anomalie détectée pour ce mois.</p>}

      <Bloc titre="Journées incomplètes (heures saisies sous l'horaire attendu)" nb={anomalies.length}>
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm">
          {anomalies.map((a) => (
            <li key={`${a.profileId}-${a.date}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                <strong>{formaterJourLong(a.date)}</strong> — {a.technicien} :{" "}
                <span className="text-red-700">
                  {a.saisies.toLocaleString("fr-FR")} h saisies sur {a.attendues.toLocaleString("fr-FR")} h
                </span>
              </span>
              <Link href={`/planning?semaine=${lundiDeLaSemaine(a.date)}`} className="text-xs font-semibold text-brand-green-dark underline">
                Ouvrir le planning
              </Link>
            </li>
          ))}
        </ul>
      </Bloc>

      <Bloc titre="Sites sans commune (pas de prime de trajet possible)" nb={d.sitesSansCommune.length}>
        <p className="text-sm">
          {d.sitesSansCommune.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={`/repertoire/clients/${s.id}/modifier`} className="underline">
                {[s.nom, s.site].filter(Boolean).join(" — ")}
              </Link>
            </span>
          ))}
        </p>
      </Bloc>

      <Bloc titre="Communes absentes du barème" nb={d.communesHorsBareme.length}>
        <p className="text-sm">
          {d.communesHorsBareme.map((c) => c.commune).join(", ")} —{" "}
          <Link href="/rh/referentiel/bareme" className="font-semibold underline">
            compléter le barème
          </Link>
        </p>
      </Bloc>

      <Bloc titre="Techniciens sans fiche Salarié (nom pour la paie)" nb={sansFiche.length}>
        <p className="text-sm">
          {sansFiche.map((t) => t.name).join(", ")} —{" "}
          <Link href="/rh/referentiel/salaries" className="font-semibold underline">
            compléter les salariés
          </Link>
        </p>
      </Bloc>
    </div>
  );
}

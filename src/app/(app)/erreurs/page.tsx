import Link from "next/link";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LIBELLE_SOURCE_INCIDENT, type SourceIncident } from "@/lib/incidents";
import { BoutonResolu } from "./bouton-resolu";

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "short", timeStyle: "short" });

/// Journal des erreurs : tout ce qui a échoué en arrière-plan (mise à jour
/// GMAO, archivage PDF, mails, notifications, relances automatiques).
export default async function ErreursPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const [{ data: ouverts }, { data: resolus }] = await Promise.all([
    supabase.from("incidents").select("*").is("resolu_le", null).order("created_at", { ascending: false }),
    supabase.from("incidents").select("*").not("resolu_le", "is", null).order("resolu_le", { ascending: false }).limit(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Erreurs à traiter</h1>
        <p className="text-sm text-slate-500">
          Ce qui a échoué en arrière-plan sans bloquer le travail : mise à jour GMAO après validation d&apos;un BI, archivage
          du PDF, mails, notifications des techniciens, relances automatiques.
        </p>
      </div>

      {!ouverts?.length ? (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">Aucune erreur à traiter.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {ouverts.map((i, n) => (
            <div key={i.id} className={`flex flex-wrap items-start gap-3 px-4 py-3 ${n > 0 ? "border-t border-slate-100" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                    {LIBELLE_SOURCE_INCIDENT[i.source as SourceIncident] ?? i.source}
                  </span>
                  <span className="text-xs text-slate-400">{quand(i.created_at)}</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{i.titre}</p>
                {i.detail && <p className="whitespace-pre-line text-xs text-slate-600">{i.detail}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {i.lien && (
                  <Link
                    href={i.lien}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Ouvrir
                  </Link>
                )}
                <BoutonResolu id={i.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!!resolus?.length && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Résolues récemment</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {resolus.map((i, n) => (
              <div key={i.id} className={`px-4 py-2 text-sm ${n > 0 ? "border-t border-slate-100" : ""}`}>
                <span className="text-slate-700">{i.titre}</span>
                <span className="text-xs text-slate-400">
                  {" "}
                  · résolue le {quand(i.resolu_le as string)}
                  {i.resolu_par ? ` par ${i.resolu_par}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Tables } from "@/lib/types";

type Demande = Tables<"demandes_depannage">;
type TechniciensParId = Record<string, { name: string; portable: string }>;

type StatLigne = {
  cle: string;
  label: string;
  total: number;
  enCours: number;
  traitees: number;
  delaiMoyenHeures: number | null;
};

function calculerStats(
  demandes: Demande[],
  cleDe: (d: Demande) => string,
  labelDe: (cle: string) => string,
): StatLigne[] {
  const parCle = new Map<string, Demande[]>();
  for (const d of demandes) {
    const cle = cleDe(d);
    const liste = parCle.get(cle) ?? [];
    liste.push(d);
    parCle.set(cle, liste);
  }

  const lignes: StatLigne[] = [];
  for (const [cle, liste] of parCle) {
    const traiteesListe = liste.filter((d) => d.statut === "traitee");
    const delais = traiteesListe
      .filter((d) => d.date_traitement)
      .map((d) => (new Date(d.date_traitement!).getTime() - new Date(d.date_creation).getTime()) / 3_600_000);
    const delaiMoyenHeures = delais.length > 0 ? delais.reduce((a, b) => a + b, 0) / delais.length : null;

    lignes.push({
      cle,
      label: labelDe(cle),
      total: liste.length,
      enCours: liste.length - traiteesListe.length,
      traitees: traiteesListe.length,
      delaiMoyenHeures,
    });
  }

  return lignes.sort((a, b) => b.total - a.total);
}

function formaterDelai(heures: number): string {
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 24) return `${heures.toFixed(1)} h`;
  const jours = Math.floor(heures / 24);
  const reste = Math.round(heures % 24);
  return `${jours} j ${reste} h`;
}

function StatChiffres({ s, compact }: { s: StatLigne; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${compact ? "text-xs" : "mt-1 text-sm"} text-slate-500`}>
      <span>{s.total} total</span>
      <span className="text-red-600">{s.enCours} en cours</span>
      <span className="text-brand-green-dark">{s.traitees} traité(s)</span>
      {s.delaiMoyenHeures !== null && <span>Délai moyen : {formaterDelai(s.delaiMoyenHeures)}</span>}
    </div>
  );
}

type Vue = "clients" | "techniciens";

export function StatistiquesTab({
  demandes,
  techniciensParId,
}: {
  demandes: Demande[];
  techniciensParId: TechniciensParId;
}) {
  const [vue, setVue] = useState<Vue>("clients");
  const [clientOuvert, setClientOuvert] = useState<string | null>(null);

  const statsClients = useMemo(() => calculerStats(demandes, (d) => d.client_nom, (cle) => cle || "Client inconnu"), [demandes]);
  const statsTechniciens = useMemo(
    () =>
      calculerStats(
        demandes,
        (d) => d.intervenant_id ?? "__non_assigne__",
        (cle) => (cle === "__non_assigne__" ? "Non assigné" : (techniciensParId[cle]?.name ?? "Inconnu")),
      ),
    [demandes, techniciensParId],
  );

  if (demandes.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Aucune donnée pour l&apos;instant</p>;
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setVue("clients")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            vue === "clients" ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Par client
        </button>
        <button
          onClick={() => setVue("techniciens")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            vue === "techniciens" ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Par technicien
        </button>
      </div>

      {vue === "clients" ? (
        <div className="space-y-2">
          {statsClients.map((s) => {
            const ouvert = clientOuvert === s.cle;
            const sitesDuClient = calculerStats(
              demandes.filter((d) => d.client_nom === s.cle),
              (d) => d.client_site,
              (cle) => cle || "Site sans nom",
            );
            return (
              <div key={s.cle} className="rounded-2xl bg-white p-4 shadow-sm">
                <button
                  onClick={() => setClientOuvert(ouvert ? null : s.cle)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="font-semibold text-slate-900">{s.label}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${ouvert ? "rotate-180" : ""}`} />
                </button>
                <StatChiffres s={s} />
                {ouvert && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {sitesDuClient.map((site) => (
                      <div key={site.cle} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-800">{site.label}</p>
                        <StatChiffres s={site} compact />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {statsTechniciens.map((s) => (
            <div key={s.cle} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">{s.label}</p>
              <StatChiffres s={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

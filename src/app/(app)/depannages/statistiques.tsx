"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/types";
import Link from "next/link";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { DepannageEquipement } from "@/lib/gmao/recurrence-depannages";

type Periode = "12m" | "annee" | "tout";
const PERIODES: { valeur: Periode; label: string }[] = [
  { valeur: "12m", label: "12 derniers mois" },
  { valeur: "annee", label: "Cette année" },
  { valeur: "tout", label: "Tout" },
];

function debutPeriode(p: Periode): string {
  const d = new Date();
  if (p === "annee") return `${d.getFullYear()}-01-01`;
  if (p === "12m") {
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }
  return "";
}

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

function formaterDelai(heures: number | null): string {
  if (heures === null) return "—";
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 24) return `${heures.toFixed(1)} h`;
  const jours = Math.floor(heures / 24);
  const reste = Math.round(heures % 24);
  return `${jours} j ${reste} h`;
}

const COLONNES_STATS: ColonneTableur[] = [
  { titre: "Nom", largeur: "40%" },
  { titre: "Total", largeur: "15%", droite: true },
  { titre: "En cours", largeur: "15%", droite: true },
  { titre: "Traités", largeur: "15%", droite: true },
  { titre: "Délai moyen", largeur: "15%", droite: true },
];

export function StatistiquesTab({
  demandes: toutesDemandes,
  techniciensParId,
  depannagesEquipements,
}: {
  demandes: Demande[];
  techniciensParId: TechniciensParId;
  depannagesEquipements: DepannageEquipement[];
}) {
  const [clientOuvert, setClientOuvert] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode>("12m");
  const debut = debutPeriode(periode);
  const demandes = useMemo(
    () => (debut ? toutesDemandes.filter((d) => String(d.date_creation).slice(0, 10) >= debut) : toutesDemandes),
    [toutesDemandes, debut],
  );
  const pannesRepetees = useMemo(() => {
    const parEquipement = new Map<string, DepannageEquipement[]>();
    for (const d of depannagesEquipements) {
      if (debut && d.date < debut) continue;
      parEquipement.set(d.equipementId, [...(parEquipement.get(d.equipementId) ?? []), d]);
    }
    return [...parEquipement.values()]
      .filter((l) => l.length >= 2)
      .map((l) => l.slice().sort((a, b) => b.date.localeCompare(a.date)))
      .sort((a, b) => b.length - a.length || b[0].date.localeCompare(a[0].date));
  }, [depannagesEquipements, debut]);

  const choixPeriode = (
    <div className="mb-5 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
      {PERIODES.map((p) => (
        <button
          key={p.valeur}
          onClick={() => setPeriode(p.valeur)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${periode === p.valeur ? "bg-brand-green text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const statsClients = useMemo(
    () => calculerStats(demandes, (d) => d.client_nom, (cle) => cle || "Client inconnu"),
    [demandes],
  );
  const statsTechniciens = useMemo(
    () =>
      calculerStats(
        demandes,
        (d) => d.intervenant_id ?? "__non_assigne__",
        (cle) => (cle === "__non_assigne__" ? "Non assigné" : (techniciensParId[cle]?.name ?? "Inconnu")),
      ),
    [demandes, techniciensParId],
  );

  if (demandes.length === 0 && pannesRepetees.length === 0) {
    return (
      <div>
        {choixPeriode}
        <p className="py-10 text-center text-sm text-slate-500">Aucun dépannage sur cette période</p>
      </div>
    );
  }

  const lignesClients = statsClients.flatMap((s) => {
    const ouvert = clientOuvert === s.cle;
    const ligneClient = [
      <button
        key="client"
        onClick={() => setClientOuvert(ouvert ? null : s.cle)}
        className="font-semibold text-slate-900 hover:underline"
      >
        {ouvert ? "▾" : "▸"} {s.label}
      </button>,
      String(s.total),
      String(s.enCours),
      String(s.traitees),
      formaterDelai(s.delaiMoyenHeures),
    ];
    if (!ouvert) return [ligneClient];

    const sites = calculerStats(
      demandes.filter((d) => d.client_nom === s.cle),
      (d) => d.client_site,
      (cle) => cle || "Site sans nom",
    );
    return [
      ligneClient,
      ...sites.map((site) => [
        `      ↳ ${site.label}`,
        String(site.total),
        String(site.enCours),
        String(site.traitees),
        formaterDelai(site.delaiMoyenHeures),
      ]),
    ];
  });

  const lignesTechniciens = statsTechniciens.map((s) => [
    s.label,
    String(s.total),
    String(s.enCours),
    String(s.traitees),
    formaterDelai(s.delaiMoyenHeures),
  ]);

  return (
    <div className="space-y-8">
      {choixPeriode}
      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Pannes répétées par équipement</h2>
        <p className="mb-2 text-xs text-slate-500">
          Équipements avec au moins 2 dépannages sur la période (demandes de dépannage et BI de dépannage faits sans demande).
        </p>
        {pannesRepetees.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">Aucun équipement en panne à répétition.</p>
        ) : (
          <Tableur
            colonnes={[
              { titre: "Équipement", largeur: "30%" },
              { titre: "Client — Site", largeur: "30%" },
              { titre: "Dépannages", largeur: "12%", droite: true },
              { titre: "Dates", largeur: "28%" },
            ]}
            lignes={pannesRepetees.map((liste) => {
              const d = liste[0];
              return [
                d.siteId ? (
                  <Link key="eq" href={`/gmao/clients/${d.siteId}/equipements/${d.equipementId}`} className="font-semibold text-slate-900 hover:underline">
                    {d.equipementNom || "Équipement"}
                  </Link>
                ) : (
                  d.equipementNom || "Équipement"
                ),
                [d.client, d.site].filter(Boolean).join(" — "),
                <span key="n" className="font-bold text-red-600">{liste.length}</span>,
                liste.map((x) => x.date.split("-").reverse().join("/")).join(", "),
              ];
            })}
          />
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Par client</h2>
        <Tableur colonnes={COLONNES_STATS} lignes={lignesClients} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Par technicien</h2>
        <Tableur colonnes={COLONNES_STATS} lignes={lignesTechniciens} />
      </section>
    </div>
  );
}

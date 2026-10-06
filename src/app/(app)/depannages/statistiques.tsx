"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/types";
import { Tableur, type ColonneTableur } from "@/components/tableur";

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
  demandes,
  techniciensParId,
}: {
  demandes: Demande[];
  techniciensParId: TechniciensParId;
}) {
  const [clientOuvert, setClientOuvert] = useState<string | null>(null);

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

  if (demandes.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Aucune donnée pour l&apos;instant</p>;
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

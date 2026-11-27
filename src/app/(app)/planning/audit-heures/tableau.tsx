"use client";

import { useFiltreClientSite } from "@/components/filtre-client-site";
import { useMemo } from "react";
import Link from "next/link";
import {ArrowLeft, Download } from "lucide-react";
import type { LigneAuditHeures } from "./calcul";

function fmtH(h: number): string {
  return h.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function Entete({ titre, teinte }: { titre: string; teinte: string }) {
  return (
    <th colSpan={2} className={`border-b border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wide ${teinte}`}>
      {titre}
    </th>
  );
}

/// Part des heures Tech du contrat déjà réalisée. Rouge : dépassé ; orange :
/// réalisé + programmé dépasse le contrat.
function Consommation({ realise, programme, contrat }: { realise: number; programme: number; contrat: number }) {
  if (contrat <= 0) return <span className="text-slate-300">—</span>;
  const pct = Math.round((realise / contrat) * 100);
  const style =
    realise > contrat
      ? "bg-red-100 text-red-700"
      : realise + programme > contrat
        ? "bg-orange-100 text-orange-700"
        : "bg-slate-100 text-slate-600";
  const titre =
    realise > contrat
      ? `Dépassé de ${fmtH(realise - contrat)} h`
      : realise + programme > contrat
        ? `Réalisé + programmé dépasse le contrat de ${fmtH(realise + programme - contrat)} h`
        : undefined;
  return (
    <span title={titre} className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${style}`}>
      {pct} %
    </span>
  );
}

type Ligne = LigneAuditHeures;
const COLONNES_SOMME = [
  "progTech",
  "progAssistant",
  "programmeesTech",
  "realTech",
  "realAssistant",
  "contratTech",
  "contratAssistant",
  "executionTech",
  "executionAssistant",
] as const;
type ColonneSomme = (typeof COLONNES_SOMME)[number];

function sommer(lignes: Ligne[]): Record<ColonneSomme, number> {
  return Object.fromEntries(COLONNES_SOMME.map((c) => [c, lignes.reduce((t, l) => t + l[c], 0)])) as Record<ColonneSomme, number>;
}

export function AuditHeuresTableau({ lignes }: { lignes: LigneAuditHeures[] }) {
  const { filtrees, bloc } = useFiltreClientSite(lignes, (l) => ({ client: l.clientNom, site: l.clientSite }), "heures");

  const totaux = useMemo(
    () =>
      filtrees.reduce(
        (t, l) => ({
          progTech: t.progTech + l.progTech,
          progAssistant: t.progAssistant + l.progAssistant,
          programmeesTech: t.programmeesTech + l.programmeesTech,
          realTech: t.realTech + l.realTech,
          realAssistant: t.realAssistant + l.realAssistant,
          contratTech: t.contratTech + l.contratTech,
          contratAssistant: t.contratAssistant + l.contratAssistant,
          executionTech: t.executionTech + l.executionTech,
          executionAssistant: t.executionAssistant + l.executionAssistant,
        }),
        {
          progTech: 0,
          progAssistant: 0,
          programmeesTech: 0,
          realTech: 0,
          realAssistant: 0,
          contratTech: 0,
          contratAssistant: 0,
          executionTech: 0,
          executionAssistant: 0,
        },
      ),
    [filtrees],
  );

  // Sites d'un même client à la suite (tri par n° de client) : sous-total
  // dès qu'il en a plusieurs.
  const groupes = useMemo(() => {
    const liste: { client: string; lignes: Ligne[]; total: Record<ColonneSomme, number> }[] = [];
    for (const l of filtrees) {
      const dernier = liste[liste.length - 1];
      if (dernier && dernier.client === l.clientNom) dernier.lignes.push(l);
      else liste.push({ client: l.clientNom, lignes: [l], total: sommer([]) });
    }
    for (const g of liste) g.total = sommer(g.lignes);
    return liste;
  }, [filtrees]);
  const depasses = filtrees.filter((l) => l.contratTech > 0 && l.realTech > l.contratTech).length;
  const surProgrammes = filtrees.filter(
    (l) => l.contratTech > 0 && l.realTech <= l.contratTech && l.realTech + l.programmeesTech > l.contratTech,
  ).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/planning"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        <a
          href="/planning/audit-heures/export"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          title="Exporter en Excel"
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
        </a>
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Audit Heures — Clients sous contrat
      </h1>
      <p className="mb-4 text-sm text-slate-500">
        {filtrees.length} site(s) — classé par numéro de client et de site
        {depasses > 0 && <span className="ml-2 font-semibold text-red-600">· {depasses} en dépassement</span>}
        {surProgrammes > 0 && <span className="ml-2 font-semibold text-orange-600">· {surProgrammes} sur-programmé(s)</span>}
      </p>

      {bloc}

      {filtrees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun résultat</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 border-b border-slate-200 bg-white px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  N°
                </th>
                <th rowSpan={2} className="border-b border-slate-200 bg-white px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Client — Site
                </th>
                <th rowSpan={2} className="border-b border-slate-200 bg-white px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Consommé
                </th>
                <Entete titre="À programmer" teinte="bg-amber-50 text-amber-700" />
                <th className="border-b border-slate-200 bg-indigo-50 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-indigo-700">
                  Programmées
                </th>
                <Entete titre="Déjà réalisées" teinte="bg-green-50 text-brand-green-dark" />
                <Entete titre="Total dû au contrat" teinte="bg-slate-50 text-slate-600" />
                <Entete titre="Heure exécution" teinte="bg-violet-50 text-violet-700" />
              </tr>
              <tr>
                <th className="border-b border-slate-200 bg-amber-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-amber-700">Tech</th>
                <th className="border-b border-slate-200 bg-amber-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-amber-700">Assist.</th>
                <th className="border-b border-slate-200 bg-indigo-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-indigo-700">Tech</th>
                <th className="border-b border-slate-200 bg-green-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-brand-green-dark">Tech</th>
                <th className="border-b border-slate-200 bg-green-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-brand-green-dark">Assist.</th>
                <th className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[11px] font-semibold text-slate-600">Tech</th>
                <th className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-right text-[11px] font-semibold text-slate-600">Assist.</th>
                <th className="border-b border-slate-200 bg-violet-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-violet-700">Tech</th>
                <th className="border-b border-slate-200 bg-violet-50/60 px-2 py-1.5 text-right text-[11px] font-semibold text-violet-700">Assist.</th>
              </tr>
            </thead>
            <tbody>
              {groupes.flatMap((g) => [
                ...g.lignes.map((l, i) => (
                <tr key={l.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                  <td className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-inherit px-3 py-2 font-semibold text-slate-900">
                    {l.numero || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {[l.clientNom, l.clientSite].filter(Boolean).join(" — ")}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2 text-center">
                    <Consommation realise={l.realTech} programme={l.programmeesTech} contrat={l.contratTech} />
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right text-amber-700">{fmtH(l.progTech)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right text-amber-700">{fmtH(l.progAssistant)}</td>
                  <td className="border-b border-slate-100 bg-indigo-50/40 px-2 py-2 text-right text-indigo-700">{fmtH(l.programmeesTech)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right text-brand-green-dark">{fmtH(l.realTech)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right text-brand-green-dark">{fmtH(l.realAssistant)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right text-slate-600">{fmtH(l.contratTech)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-right text-slate-600">{fmtH(l.contratAssistant)}</td>
                  <td className="border-b border-slate-100 bg-violet-50/40 px-2 py-2 text-right text-violet-700">{fmtH(l.executionTech)}</td>
                  <td className="border-b border-slate-100 bg-violet-50/40 px-2 py-2 text-right text-violet-700">{fmtH(l.executionAssistant)}</td>
                </tr>
                )),
                ...(g.lignes.length > 1
                  ? [
                      <tr key={`total-${g.client}`} className="bg-slate-100/70 font-semibold text-slate-800">
                        <td className="sticky left-0 border-b border-slate-200 bg-slate-100 px-3 py-1.5" colSpan={2}>
                          Total {g.client} ({g.lignes.length} sites)
                        </td>
                        <td className="border-b border-slate-200 px-2 py-1.5 text-center">
                          <Consommation realise={g.total.realTech} programme={g.total.programmeesTech} contrat={g.total.contratTech} />
                        </td>
                        {COLONNES_SOMME.map((c) => (
                          <td key={c} className="border-b border-slate-200 px-2 py-1.5 text-right">
                            {fmtH(g.total[c])}
                          </td>
                        ))}
                      </tr>,
                    ]
                  : []),
              ])}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <td className="sticky left-0 bg-slate-100 px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-2 py-2 text-center">
                  <Consommation realise={totaux.realTech} programme={totaux.programmeesTech} contrat={totaux.contratTech} />
                </td>
                <td className="px-2 py-2 text-right text-amber-700">{fmtH(totaux.progTech)}</td>
                <td className="px-2 py-2 text-right text-amber-700">{fmtH(totaux.progAssistant)}</td>
                <td className="px-2 py-2 text-right text-indigo-700">{fmtH(totaux.programmeesTech)}</td>
                <td className="px-2 py-2 text-right text-brand-green-dark">{fmtH(totaux.realTech)}</td>
                <td className="px-2 py-2 text-right text-brand-green-dark">{fmtH(totaux.realAssistant)}</td>
                <td className="px-2 py-2 text-right text-slate-600">{fmtH(totaux.contratTech)}</td>
                <td className="px-2 py-2 text-right text-slate-600">{fmtH(totaux.contratAssistant)}</td>
                <td className="px-2 py-2 text-right text-violet-700">{fmtH(totaux.executionTech)}</td>
                <td className="px-2 py-2 text-right text-violet-700">{fmtH(totaux.executionAssistant)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

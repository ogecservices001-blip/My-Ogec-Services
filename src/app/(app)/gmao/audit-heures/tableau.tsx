"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Download } from "lucide-react";
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

export function AuditHeuresTableau({ lignes }: { lignes: LigneAuditHeures[] }) {
  const [recherche, setRecherche] = useState("");

  const filtrees = useMemo(
    () =>
      lignes.filter(
        (l) =>
          l.clientNom.toLowerCase().includes(recherche.toLowerCase()) ||
          l.clientSite.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [lignes, recherche],
  );

  const totaux = useMemo(
    () =>
      filtrees.reduce(
        (t, l) => ({
          progTech: t.progTech + l.progTech,
          progAssistant: t.progAssistant + l.progAssistant,
          realTech: t.realTech + l.realTech,
          realAssistant: t.realAssistant + l.realAssistant,
          contratTech: t.contratTech + l.contratTech,
          contratAssistant: t.contratAssistant + l.contratAssistant,
        }),
        { progTech: 0, progAssistant: 0, realTech: 0, realAssistant: 0, contratTech: 0, contratAssistant: 0 },
      ),
    [filtrees],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/gmao"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        <a
          href="/gmao/audit-heures/export"
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
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client ou un site..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {filtrees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun résultat</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  N°
                </th>
                <th rowSpan={2} className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Client — Site
                </th>
                <Entete titre="À programmer" teinte="bg-amber-50 text-amber-700" />
                <Entete titre="Déjà réalisées" teinte="bg-green-50 text-brand-green-dark" />
                <Entete titre="Total dû au contrat" teinte="bg-slate-50 text-slate-600" />
              </tr>
              <tr>
                <th className="border-b border-slate-200 bg-amber-50/60 px-3 py-1.5 text-right text-[11px] font-semibold text-amber-700">Tech</th>
                <th className="border-b border-slate-200 bg-amber-50/60 px-3 py-1.5 text-right text-[11px] font-semibold text-amber-700">Assist.</th>
                <th className="border-b border-slate-200 bg-green-50/60 px-3 py-1.5 text-right text-[11px] font-semibold text-brand-green-dark">Tech</th>
                <th className="border-b border-slate-200 bg-green-50/60 px-3 py-1.5 text-right text-[11px] font-semibold text-brand-green-dark">Assist.</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-right text-[11px] font-semibold text-slate-600">Tech</th>
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-right text-[11px] font-semibold text-slate-600">Assist.</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((l, i) => (
                <tr key={l.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                  <td className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-inherit px-3 py-2 font-semibold text-slate-900">
                    {l.numero || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {[l.clientNom, l.clientSite].filter(Boolean).join(" — ")}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-amber-700">{fmtH(l.progTech)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-amber-700">{fmtH(l.progAssistant)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-brand-green-dark">{fmtH(l.realTech)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-brand-green-dark">{fmtH(l.realAssistant)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-600">{fmtH(l.contratTech)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-600">{fmtH(l.contratAssistant)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <td className="sticky left-0 bg-slate-100 px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right text-amber-700">{fmtH(totaux.progTech)}</td>
                <td className="px-3 py-2 text-right text-amber-700">{fmtH(totaux.progAssistant)}</td>
                <td className="px-3 py-2 text-right text-brand-green-dark">{fmtH(totaux.realTech)}</td>
                <td className="px-3 py-2 text-right text-brand-green-dark">{fmtH(totaux.realAssistant)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtH(totaux.contratTech)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmtH(totaux.contratAssistant)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

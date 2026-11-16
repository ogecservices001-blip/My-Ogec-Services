"use client";

import { useFiltreClientSite } from "@/components/filtre-client-site";
import { useMemo } from "react";
import Link from "next/link";
import {ArrowLeft, Download } from "lucide-react";
import { labelPole } from "@/lib/bi/constants";
import { POLES_HEURES_PAR_POLE, type LigneHeuresParPole } from "./calcul";

function fmtH(h: number): string {
  return h.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function HeuresParPoleTableau({ lignes }: { lignes: LigneHeuresParPole[] }) {
  const { filtrees, bloc } = useFiltreClientSite(lignes, (l) => ({ client: l.clientNom, site: l.clientSite }), "heures");

  const totaux = useMemo(() => {
    const parPole: Record<string, number> = {};
    let total = 0;
    for (const pole of POLES_HEURES_PAR_POLE) parPole[pole] = 0;
    for (const l of filtrees) {
      for (const pole of POLES_HEURES_PAR_POLE) parPole[pole] += l.heuresParPole[pole] ?? 0;
      total += l.total;
    }
    return { parPole, total };
  }, [filtrees]);

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
          href="/planning/heures-par-pole/export"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          title="Exporter en Excel"
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
        </a>
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Heures par pôle</h1>
      <p className="mb-4 text-sm text-slate-500">
        {filtrees.length} site(s) avec de l&apos;activité — hors Entretien sous contrat (voir Audit Heures)
      </p>

      {bloc}

      {filtrees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun résultat</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 border-b border-slate-200 bg-white px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  N°
                </th>
                <th className="border-b border-slate-200 bg-white px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Client — Site
                </th>
                {POLES_HEURES_PAR_POLE.map((pole) => (
                  <th
                    key={pole}
                    className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {labelPole(pole)}
                  </th>
                ))}
                <th className="border-b border-slate-200 bg-brand-green/10 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-brand-green-dark">
                  Total
                </th>
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
                  {POLES_HEURES_PAR_POLE.map((pole) => (
                    <td key={pole} className="border-b border-slate-100 px-2 py-2 text-right text-slate-600">
                      {l.heuresParPole[pole] ? fmtH(l.heuresParPole[pole]) : "—"}
                    </td>
                  ))}
                  <td className="border-b border-slate-100 bg-brand-green/5 px-2 py-2 text-right font-semibold text-brand-green-dark">
                    {fmtH(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900">
                <td className="sticky left-0 bg-slate-100 px-3 py-2" colSpan={2}>
                  Total
                </td>
                {POLES_HEURES_PAR_POLE.map((pole) => (
                  <td key={pole} className="px-2 py-2 text-right text-slate-600">
                    {fmtH(totaux.parPole[pole])}
                  </td>
                ))}
                <td className="px-2 py-2 text-right text-brand-green-dark">{fmtH(totaux.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

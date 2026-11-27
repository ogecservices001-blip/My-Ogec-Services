"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LigneCa } from "@/lib/facturation/ca-facturable";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const eur = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/// CA facturable par mois de facturation : devis passés « Facturable » +
/// BI hors devis « À facturer ».
export function VueCaFacturable({ lignes }: { lignes: LigneCa[] }) {
  const anneeCourante = String(new Date().getFullYear());
  const annees = useMemo(
    () => [...new Set([anneeCourante, ...lignes.map((l) => l.mois.slice(3))])].sort().reverse(),
    [lignes, anneeCourante],
  );
  const [annee, setAnnee] = useState(anneeCourante);
  const moisCourant = String(new Date().getMonth() + 1).padStart(2, "0");
  const [moisOuvert, setMoisOuvert] = useState<string | null>(annee === anneeCourante ? moisCourant : null);

  const parMois = useMemo(
    () =>
      NOMS_MOIS.map((nom, i) => {
        const mm = String(i + 1).padStart(2, "0");
        const duMois = lignes.filter((l) => l.mois === `${mm}-${annee}`);
        const devis = duMois.filter((l) => l.type === "devis");
        const bis = duMois.filter((l) => l.type === "bi");
        const somme = (ls: LigneCa[]) => ls.reduce((t, l) => t + l.montant, 0);
        return { mm, nom, lignes: duMois, nbDevis: devis.length, montantDevis: somme(devis), nbBi: bis.length, montantBi: somme(bis), total: somme(duMois) };
      }),
    [lignes, annee],
  );
  const totalAnnee = parMois.reduce((t, m) => t + m.total, 0);
  const detail = parMois.find((m) => m.mm === moisOuvert);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">CA facturable</h1>
          <p className="text-sm text-slate-500">
            Par mois de facturation : devis passés « Facturable » + BI hors devis classés « À facturer » (montants HT).
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {annees.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAnnee(a);
                setMoisOuvert(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${a === annee ? "bg-brand-green text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <th className="border-b border-slate-200 px-4 py-2">Mois</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Devis</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">BI hors devis</th>
              <th className="border-b border-slate-200 px-4 py-2 text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {parMois.map((m) => (
              <tr
                key={m.mm}
                onClick={() => setMoisOuvert(moisOuvert === m.mm ? null : m.mm)}
                className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${moisOuvert === m.mm ? "bg-green-50" : ""}`}
              >
                <td className="px-4 py-2 font-semibold text-slate-800">
                  {moisOuvert === m.mm ? "▾" : "▸"} {m.nom}
                </td>
                <td className="px-4 py-2 text-right text-slate-600">
                  {m.nbDevis ? `${eur(m.montantDevis)} (${m.nbDevis})` : "—"}
                </td>
                <td className="px-4 py-2 text-right text-slate-600">{m.nbBi ? `${eur(m.montantBi)} (${m.nbBi})` : "—"}</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">{m.total ? eur(m.total) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900">
              <td className="px-4 py-2">Total {annee}</td>
              <td className="px-4 py-2 text-right">{eur(parMois.reduce((t, m) => t + m.montantDevis, 0))}</td>
              <td className="px-4 py-2 text-right">{eur(parMois.reduce((t, m) => t + m.montantBi, 0))}</td>
              <td className="px-4 py-2 text-right">{eur(totalAnnee)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {detail && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-slate-900">
            {detail.nom} {annee} — {detail.lignes.length ? eur(detail.total) : "rien à facturer"}
          </p>
          {detail.lignes.length > 0 && (
            <div className="divide-y divide-slate-100">
              {detail.lignes
                .slice()
                .sort((a, b) => b.montant - a.montant)
                .map((l) => (
                  <Link key={`${l.type}-${l.id}`} href={l.href} className="flex items-center gap-3 py-2 text-sm hover:bg-slate-50">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${l.type === "devis" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}
                    >
                      {l.type === "devis" ? "Devis" : "BI"}
                    </span>
                    <span className="w-40 shrink-0 truncate font-semibold text-slate-800">{l.numero}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      {[l.client, l.site].filter(Boolean).join(" — ")}
                      {l.libelle ? ` · ${l.libelle}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-900">{eur(l.montant)}</span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { ListeRecherche } from "@/components/liste-recherche";
import { nomFichierAvecDate } from "@/lib/excel-export";
import { ordrePoles, type HeuresPole } from "@/lib/rh/annuel";
import { libellePole, MOIS_COURTS } from "@/lib/rh/heures-pole-affichage";
import { exporterHeuresParPole } from "./actions";

const h = (n: number) => (n ? n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "");

export function HeuresParPoleVue({ annee, anneeCourante, donnees, aujourdhui }: { annee: number; anneeCourante: number; donnees: HeuresPole[]; aujourdhui: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [salarie, setSalarie] = useState("");
  const salaries = useMemo(
    () => [...new Map(donnees.map((d) => [d.profileId, d.salarie])).entries()].map(([valeur, label]) => ({ valeur, label })).sort((a, b) => a.label.localeCompare(b.label, "fr")),
    [donnees],
  );
  const visibles = donnees.filter((d) => !salarie || d.profileId === salarie);
  const poles = ordrePoles(donnees.map((d) => d.pole));
  const somme = (f: (d: HeuresPole) => boolean) => visibles.filter(f).reduce((t, d) => t + d.heures, 0);
  const total = somme(() => true);
  const annees = Array.from({ length: anneeCourante - 2025 }, (_, i) => 2026 + i);
  const salariesVisibles = salaries.filter((s) => !salarie || s.valeur === salarie);

  function exporter() {
    startTransition(async () => {
      const b64 = await exporterHeuresParPole(annee);
      const octets = atob(b64);
      const tampon = new Uint8Array(octets.length);
      for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomFichierAvecDate(`Heures_par_pole_${annee}.xlsx`);
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const th = "px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500";
  const td = "border-b border-slate-100 px-2 py-1.5 text-right whitespace-nowrap";
  const tdTotal = `${td} bg-brand-green/5 font-semibold text-brand-green-dark`;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Heures par pôle</h1>
          <p className="text-sm text-slate-500">
            Heures travaillées des salariés (hors absences), calculées depuis le{" "}
            <Link href="/rh/pointage" className="font-semibold text-brand-green-dark underline">
              Pointage mensuel
            </Link>
            {annee === anneeCourante && ` — jusqu'au ${aujourdhui.split("-").reverse().join("/")}`}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={annee}
            onChange={(e) => router.push(`/rh/heures-par-pole?annee=${e.target.value}`)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
          >
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button onClick={exporter} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <Download className="h-4 w-4" />
            {pending ? "Export…" : "Export Excel"}
          </button>
        </div>
      </div>

      <div className="mb-4 max-w-sm">
        <ListeRecherche valeur={salarie} onChange={setSalarie} options={salaries} placeholder="Tous les salariés" />
      </div>

      {donnees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucune heure pointée sur {annee}.</p>
      ) : (
        <>
          <p className="mb-2 text-lg font-bold text-slate-900">Par pôle et par mois</p>
          <div className="mb-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pôle</th>
                  {MOIS_COURTS.map((m) => (
                    <th key={m} className={th}>
                      {m}
                    </th>
                  ))}
                  <th className={`${th} text-brand-green-dark`}>Total</th>
                  <th className={th}>%</th>
                </tr>
              </thead>
              <tbody>
                {poles.map((p) => {
                  const t = somme((d) => d.pole === p);
                  return (
                    <tr key={p}>
                      <td className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-white px-2 py-1.5 font-semibold text-slate-900">{libellePole(p)}</td>
                      {MOIS_COURTS.map((m, i) => (
                        <td key={m} className={td}>
                          {h(somme((d) => d.pole === p && d.mois === i + 1))}
                        </td>
                      ))}
                      <td className={tdTotal}>{h(t)}</td>
                      <td className={`${td} text-slate-500`}>{total ? `${Math.round((t / total) * 100)} %` : ""}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="sticky left-0 bg-slate-100 px-2 py-1.5">Total</td>
                  {MOIS_COURTS.map((m, i) => (
                    <td key={m} className="px-2 py-1.5 text-right">
                      {h(somme((d) => d.mois === i + 1))}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right text-brand-green-dark">{h(total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mb-2 text-lg font-bold text-slate-900">Par salarié sur l&apos;année</p>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Salarié</th>
                  {poles.map((p) => (
                    <th key={p} className={th}>
                      {libellePole(p)}
                    </th>
                  ))}
                  <th className={`${th} text-brand-green-dark`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {salariesVisibles.map((s) => (
                  <tr key={s.valeur}>
                    <td className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-white px-2 py-1.5 font-semibold text-slate-900">{s.label}</td>
                    {poles.map((p) => (
                      <td key={p} className={td}>
                        {h(somme((d) => d.profileId === s.valeur && d.pole === p))}
                      </td>
                    ))}
                    <td className={tdTotal}>{h(somme((d) => d.profileId === s.valeur))}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className="sticky left-0 bg-slate-100 px-2 py-1.5">Total</td>
                  {poles.map((p) => (
                    <td key={p} className="px-2 py-1.5 text-right">
                      {h(somme((d) => d.pole === p))}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right text-brand-green-dark">{h(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

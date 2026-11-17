"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { nomFichierAvecDate } from "@/lib/excel-export";
import { totalRecap, type LigneRecap } from "@/lib/rh/annuel";
import { exporterRecapAnnuel } from "./actions";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const h = (n: number) => (n ? n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "");
const eur = (n: number) => (n ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "");

function Tableau({ titre, lignes, motifs }: { titre: string; lignes: LigneRecap[]; motifs: string[] }) {
  const total = totalRecap(lignes, motifs);
  const cellule = "border-b border-slate-100 px-2 py-1.5 text-right whitespace-nowrap";
  const rangee = (l: LigneRecap, gras = false) => (
    <tr key={l.cle} className={gras ? "bg-slate-100 font-bold text-slate-900" : ""}>
      <td className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-inherit px-2 py-1.5 font-semibold text-slate-900">{l.nom}</td>
      <td className={`${cellule} font-semibold text-brand-green-dark`}>{h(l.total)}</td>
      <td className={cellule}>{h(l.hn)}</td>
      <td className={cellule}>{h(l.hs25)}</td>
      <td className={cellule}>{h(l.hs50)}</td>
      <td className={cellule}>{h(l.hs100)}</td>
      {motifs.map((m) => (
        <td key={m} className={`${cellule} text-amber-800`}>
          {h(l.absences[m] ?? 0)}
        </td>
      ))}
      <td className={cellule}>{l.paniersNb || ""}</td>
      <td className={cellule}>{eur(l.paniersMontant)}</td>
      <td className={cellule}>{eur(l.trajet)}</td>
      <td className={cellule}>{eur(l.transport)}</td>
    </tr>
  );
  const entete = "px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide";
  return (
    <div className="mb-6">
      <p className="mb-2 text-lg font-bold text-slate-900">{titre}</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Salarié</th>
              <th className={`${entete} text-brand-green-dark`}>Heures total</th>
              <th className={entete}>H norm.</th>
              <th className={entete}>HS 25 %</th>
              <th className={entete}>HS 50 %</th>
              <th className={entete}>HS 100 %</th>
              {motifs.map((m) => (
                <th key={m} className={`${entete} text-amber-800`}>
                  {m}
                </th>
              ))}
              <th className={entete}>Paniers</th>
              <th className={entete}>Montant paniers</th>
              <th className={entete}>Trajets</th>
              <th className={entete}>Transports</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => rangee(l))}
            {rangee(total, true)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecapVue({
  annee,
  mois,
  anneeCourante,
  annuel,
  mensuel,
  aujourdhui,
}: {
  annee: number;
  mois: number;
  anneeCourante: number;
  annuel: { lignes: LigneRecap[]; motifs: string[] };
  mensuel: { lignes: LigneRecap[]; motifs: string[] };
  aujourdhui: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const annees = Array.from({ length: anneeCourante - 2025 }, (_, i) => 2026 + i);
  const aller = (a: number, m: number) => router.push(`/rh/recap-annuel?annee=${a}&mois=${m}`);

  function exporter() {
    startTransition(async () => {
      const b64 = await exporterRecapAnnuel(annee, mois);
      const octets = atob(b64);
      const tampon = new Uint8Array(octets.length);
      for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomFichierAvecDate(`Recapitulatif_annuel_${annee}.xlsx`);
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const select = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Récapitulatif annuel</h1>
          <p className="text-sm text-slate-500">
            Heures par salarié, techniciens et cadres, calculées depuis le{" "}
            <Link href="/rh/pointage" className="font-semibold text-brand-green-dark underline">
              Pointage mensuel
            </Link>
            {annee === anneeCourante && ` — jusqu'au ${aujourdhui.split("-").reverse().join("/")}`}. Absences en heures.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={annee} onChange={(e) => aller(Number(e.target.value), mois)} className={select}>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={mois} onChange={(e) => aller(annee, Number(e.target.value))} className={select}>
            {MOIS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <button onClick={exporter} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <Download className="h-4 w-4" />
            {pending ? "Export…" : "Export Excel"}
          </button>
        </div>
      </div>
      <Tableau titre={`Année ${annee}`} lignes={annuel.lignes} motifs={annuel.motifs} />
      <Tableau titre={`${MOIS[mois - 1]} ${annee}`} lignes={mensuel.lignes} motifs={annuel.motifs} />
    </div>
  );
}

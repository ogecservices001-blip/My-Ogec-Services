"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Users } from "lucide-react";
import type { Pointage } from "@/lib/types";
import { importerPointagesDuMois } from "./actions";

const COULEURS = [
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
];

function moisPrecedent(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function moisSuivant(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function libelleMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, 1));
  const texte = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
function fmtH(h: number): string {
  return h.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function PointagesListe({ mois, pointages }: { mois: string; pointages: Pointage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resultat, setResultat] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function importer() {
    setErreur(null);
    setResultat(null);
    startTransition(async () => {
      const res = await importerPointagesDuMois(mois);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setResultat(res.importes ?? 0);
      router.refresh();
    });
  }

  const parTechnicien = new Map<string, Pointage[]>();
  for (const p of pointages) {
    const cle = p.technicien_nom || "Sans technicien";
    const liste = parTechnicien.get(cle) ?? [];
    liste.push(p);
    parTechnicien.set(cle, liste);
  }
  const techniciens = [...parTechnicien.keys()].sort((a, b) => a.localeCompare(b));
  const dernierImport = pointages.length > 0 ? pointages[0].importe_le : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/ressources-humaines?mois=${moisPrecedent(mois)}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
        </Link>
        <p className="text-sm font-semibold text-slate-700">{libelleMois(mois)}</p>
        <Link
          href={`/ressources-humaines?mois=${moisSuivant(mois)}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <button
          onClick={importer}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-green-dark disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} strokeWidth={2.25} />
          {pending ? "Import..." : "Importer depuis le Planning"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Remplace entièrement le pointage déjà importé pour {libelleMois(mois).toLowerCase()} par l&apos;état actuel du
          planning — une fois importé, modifier le planning ne change plus ces chiffres tant qu&apos;on ne réimporte pas.
        </p>
        {dernierImport && (
          <p className="mt-1 text-xs text-slate-400">
            Dernier import : {new Date(dernierImport).toLocaleString("fr-FR")}
          </p>
        )}
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        {resultat !== null && <p className="mt-2 text-sm font-medium text-brand-green-dark">{resultat} ligne(s) importée(s).</p>}
      </div>

      {techniciens.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun pointage importé pour ce mois</p>
      ) : (
        <div className="space-y-3">
          {techniciens.map((nom, i) => (
            <Technicien key={nom} nom={nom} pointages={parTechnicien.get(nom)!} couleur={COULEURS[i % COULEURS.length]} />
          ))}
        </div>
      )}
    </div>
  );
}

function Technicien({ nom, pointages, couleur }: { nom: string; pointages: Pointage[]; couleur: { bg: string; text: string } }) {
  const [ouvert, setOuvert] = useState(false);
  const total = pointages.reduce((s, p) => s + p.heures, 0);
  const tries = [...pointages].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button onClick={() => setOuvert((v) => !v)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${couleur.bg}`}>
          <Users className={`h-5 w-5 ${couleur.text}`} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{nom}</span>
          <span className="block text-xs text-slate-500">
            {fmtH(total)}h sur {pointages.length} jour(s) pointé(s)
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && (
        <div className="space-y-1.5 px-4 pb-4">
          {tries.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-xs">
              <span className="text-slate-600">
                {p.date.split("-").reverse().join("/")} — {[p.client_nom, p.site].filter(Boolean).join(" — ")}
              </span>
              <span className="font-semibold text-slate-900">{fmtH(p.heures)}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

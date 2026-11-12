"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { CreneauCarte } from "../creneau-carte";
import type { CreneauMonPlanning } from "../actions";
import { ajouterJours, formaterJourCourt, lundiDeLaSemaine } from "@/lib/planning/dates";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

/// Semaine du technicien connecté, du lundi au vendredi, en lecture seule :
/// 5 colonnes sur PC, jours empilés sur téléphone.
export function MaSemaine({
  lundiSemaine,
  creneaux,
  joursFeries,
}: {
  lundiSemaine: string;
  creneaux: CreneauMonPlanning[];
  joursFeries: string[];
}) {
  const router = useRouter();
  const inputDateRef = useRef<HTMLInputElement>(null);
  const prefixe = "/planning/mon-planning?vue=semaine&semaine=";
  const jours = JOURS.map((nom, i) => ({ nom, date: ajouterJours(lundiSemaine, i) }));
  const aujourdhui = new Date().toISOString().slice(0, 10);

  function ouvrirCalendrier() {
    const input = inputDateRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!input) return;
    if (input.showPicker) input.showPicker();
    else input.focus();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={`${prefixe}${ajouterJours(lundiSemaine, -7)}`}
          className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">Semaine précédente</span>
        </Link>
        <div className="relative flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-700">
            {formaterJourCourt(jours[0].date)} — {formaterJourCourt(jours[4].date)}
          </p>
          <button
            onClick={ouvrirCalendrier}
            title="Choisir une date"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <input
            ref={inputDateRef}
            type="date"
            defaultValue={lundiSemaine}
            onChange={(e) => e.target.value && router.push(`${prefixe}${lundiDeLaSemaine(e.target.value)}`)}
            className="pointer-events-none absolute inset-0 h-9 w-9 opacity-0"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        <Link
          href={`${prefixe}${ajouterJours(lundiSemaine, 7)}`}
          className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <span className="hidden sm:inline">Semaine suivante</span>
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {jours.map((jour) => {
          const duJour = creneaux.filter((c) => c.date === jour.date);
          const ferie = joursFeries.includes(jour.date);
          const estAujourdhui = jour.date === aujourdhui;
          return (
            <div
              key={jour.date}
              className={`rounded-2xl bg-white p-3 shadow-sm ${estAujourdhui ? "ring-2 ring-brand-green" : ""}`}
            >
              <div className={`mb-2 rounded-lg px-2 py-1.5 text-sm font-bold ${ferie ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-700"}`}>
                {jour.nom} <span className="font-normal text-slate-400">{formaterJourCourt(jour.date)}</span>
                {ferie && <span className="ml-1 text-xs">Férié</span>}
              </div>
              <div className="space-y-2">
                {duJour.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-400">Rien de prévu</p>
                ) : (
                  duJour.map((c) => <CreneauCarte key={c.id} creneau={c} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

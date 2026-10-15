"use client";

import { useState } from "react";
import { ChevronDown, CalendarDays } from "lucide-react";
import { CreneauCarte } from "../creneau-carte";
import type { CreneauMonPlanning } from "../actions";

const COULEURS = [
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
];

function formaterJour(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  const texte = d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function MonPlanningListe({ jours }: { jours: [string, CreneauMonPlanning[]][] }) {
  if (jours.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Aucun créneau planifié pour les 3 prochaines semaines</p>;
  }

  return (
    <div className="space-y-3">
      {jours.map(([date, creneaux], i) => (
        <Jour key={date} date={date} creneaux={creneaux} couleur={COULEURS[i % COULEURS.length]} ouvertParDefaut={i < 2} />
      ))}
    </div>
  );
}

function Jour({
  date,
  creneaux,
  couleur,
  ouvertParDefaut,
}: {
  date: string;
  creneaux: CreneauMonPlanning[];
  couleur: { bg: string; text: string };
  ouvertParDefaut: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button onClick={() => setOuvert((v) => !v)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${couleur.bg}`}>
          <CalendarDays className={`h-5 w-5 ${couleur.text}`} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{formaterJour(date)}</span>
          <span className="block text-xs text-slate-500">{creneaux.length} créneau(x)</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && (
        <div className="space-y-2 px-4 pb-4">
          {creneaux.map((c) => (
            <CreneauCarte key={c.id} creneau={c} isAdmin={false} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { History } from "lucide-react";

/// « Saisie retrouvée » : une saisie non envoyée existe sur ce téléphone.
export function SaisieRetrouvee({
  libelle,
  majLe,
  onReprendre,
  onIgnorer,
}: {
  libelle: string;
  majLe: string;
  onReprendre: () => void;
  onIgnorer: () => void;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <History className="h-4 w-4" /> Saisie retrouvée sur ce téléphone
      </p>
      <p className="mt-1 text-sm text-amber-900">
        {libelle} — enregistrée le {new Date(majLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onReprendre} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Reprendre
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Ignorer cette saisie ? Elle sera effacée de ce téléphone.")) onIgnorer();
          }}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}

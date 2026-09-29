"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ChampListe, ChampListeLigne } from "@/lib/gmao/types";

/// Éditeur d'un `ChampListe` : une liste de lignes ajoutables/
/// supprimables librement, chaque ligne portant les mêmes sous-champs
/// (ex: "Filtres" — Référence/Type/Taille/Nombre). Port de
/// champ_liste_editor.dart.
export function ChampListeEditor({
  definition,
  lignes,
  onChange,
}: {
  definition: ChampListe;
  lignes: ChampListeLigne[];
  onChange: (lignes: ChampListeLigne[]) => void;
}) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{definition.label}</p>
        <button
          type="button"
          onClick={() => {
            const nouvelle: ChampListeLigne = {};
            for (const sc of definition.sousChamps) nouvelle[sc.cle] = "";
            onChange([...lignes, nouvelle]);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-green hover:bg-green-50"
          title="Ajouter une ligne"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      {lignes.length === 0 && (
        <p className="text-xs text-slate-400">Aucune ligne — clique sur + pour en ajouter une</p>
      )}

      {lignes.map((ligne, i) => (
        <div key={i} className="mb-2 flex items-start gap-2">
          {definition.sousChamps.map((sc) => (
            <div key={sc.cle} className="flex-1">
              <label className="mb-0.5 block text-[11px] text-slate-500">
                {sc.label}
                {sc.unite ? ` (${sc.unite})` : ""}
              </label>
              <input
                value={ligne[sc.cle] ?? ""}
                onChange={(e) => {
                  const copie = lignes.map((l) => ({ ...l }));
                  copie[i][sc.cle] = e.target.value;
                  onChange(copie);
                }}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange(lignes.filter((_, j) => j !== i))}
            className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
            title="Supprimer cette ligne"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

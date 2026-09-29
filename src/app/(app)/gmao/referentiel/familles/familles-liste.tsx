"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, ChevronRight, Wrench } from "lucide-react";
import type { TypeEquipement } from "@/lib/gmao/types";

export function FamillesListe({ familles }: { familles: TypeEquipement[] }) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () =>
      familles.filter(
        (f) =>
          f.nom.toLowerCase().includes(recherche.toLowerCase()) ||
          f.code.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [familles, recherche],
  );

  return (
    <div>
      <Link
        href="/gmao/referentiel"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Référentiel équipements (GMAO)
      </h1>
      <p className="mb-5 text-sm text-slate-500">{filtres.length} famille(s)</p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher une famille..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {filtres.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucune famille trouvée</p>
      ) : (
        <ul className="space-y-3">
          {filtres.map((f) => (
            <li key={f.id}>
              <Link
                href={`/gmao/referentiel/familles/${f.id}`}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100">
                  <Wrench className="h-5 w-5 text-teal-600" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{f.nom}</span>
                  <span className="block text-xs text-slate-400">
                    {f.code} · {f.checklist.length} opération(s) · {f.groupes_mesures.length} groupe(s)
                    de mesures
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

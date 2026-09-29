"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, ChevronRight, Building } from "lucide-react";
import type { HeuresAnnee } from "@/lib/gmao/calcul-heures-visite";

export type ClientGroupe = {
  nom: string;
  siteIds: string[];
  nbSites: number;
  heures: HeuresAnnee;
  /// Non-null quand ce client n'a qu'un seul site — on saute alors
  /// directement au parc, sans passer par le sélecteur de site.
  siteUniqueId: string | null;
};

export function GmaoClientsListe({
  groupes,
  horsContrat,
  titre,
}: {
  groupes: ClientGroupe[];
  horsContrat: boolean;
  titre: string;
}) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () => groupes.filter((g) => g.nom.toLowerCase().includes(recherche.toLowerCase())),
    [groupes, recherche],
  );

  return (
    <div>
      <Link
        href="/gmao"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{titre}</h1>
      <p className="mb-5 text-sm text-slate-500">{filtres.length} client(s)</p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {filtres.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun client trouvé</p>
      ) : (
        <ul className="space-y-3">
          {filtres.map((g) => (
            <li key={g.nom}>
              <Link
                href={
                  g.siteUniqueId
                    ? `/gmao/clients/${g.siteUniqueId}/equipements`
                    : `/gmao/clients/groupe/${encodeURIComponent(g.nom)}?horsContrat=${horsContrat ? 1 : 0}`
                }
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    horsContrat ? "bg-orange-100" : "bg-green-100"
                  }`}
                >
                  <Building
                    className={`h-5 w-5 ${horsContrat ? "text-orange-600" : "text-brand-green-dark"}`}
                    strokeWidth={2}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{g.nom}</span>
                  <span className="block text-xs text-slate-400">{g.nbSites} site(s)</span>
                  {(g.heures.prevues.heuresTech > 0 || g.heures.prevues.heuresAssistant > 0) && (
                    <span className="block text-xs font-semibold text-teal-700">
                      Heures prévues : {g.heures.prevues.heuresTech}h Tech / {g.heures.prevues.heuresAssistant}h
                      Assistant
                    </span>
                  )}
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

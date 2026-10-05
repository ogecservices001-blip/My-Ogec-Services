"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, FileSignature, Download } from "lucide-react";
import { DevisEntete } from "../entete";
import { eur } from "../registre-liste";

export type ClientGroupe = {
  nom: string;
  sites: { id: string; site: string; nbDevis: number }[];
  nbDevis: number;
  nbCommandes: number;
  montantTotal: number;
  montantCommande: number;
};

export function ParClientListe({
  groupes,
  horsContrat,
  isAdmin,
}: {
  groupes: ClientGroupe[];
  horsContrat: boolean;
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () => groupes.filter((g) => g.nom.toLowerCase().includes(recherche.toLowerCase())),
    [groupes, recherche],
  );

  return (
    <div>
      <DevisEntete horsContrat={horsContrat} isAdmin={isAdmin} vueActive="client" />

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
        <p className="py-10 text-center text-sm text-slate-500">
          {groupes.length === 0 ? 'Aucun devis pour l\'instant — "Importer" pour commencer' : "Aucun résultat"}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtres.map((g) => (
            <li key={g.nom} className="flex items-center gap-2">
              <Link
                href={g.sites.length === 1 ? `/devis/site/${g.sites[0].id}` : `/devis/groupe/${encodeURIComponent(g.nom)}?horsContrat=${horsContrat ? 1 : 0}`}
                className="flex flex-1 items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <FileSignature className="h-5 w-5 text-amber-600" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{g.nom}</p>
                  <p className="text-sm text-slate-400">
                    {g.nbDevis} devis · {g.nbCommandes} commandé(s)
                    {isAdmin && ` · ${eur(g.montantTotal)}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
              {isAdmin && (
                <a
                  href={`/devis/export?nom=${encodeURIComponent(g.nom)}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
                  title={`Exporter les devis de ${g.nom}`}
                >
                  <Download className="h-4 w-4" strokeWidth={2} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

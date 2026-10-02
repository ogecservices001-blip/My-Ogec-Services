"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  ChevronRight,
  Building2,
  Plus,
  Upload,
  Download,
} from "lucide-react";
import type { Site } from "@/lib/types";

export function ClientsListe({
  sites,
  horsContrat,
  isAdmin,
}: {
  sites: Site[];
  horsContrat: boolean;
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");

  const groupes = useMemo(() => {
    const parNom = new Map<string, Site[]>();
    for (const s of sites) {
      if (!s.nom.toLowerCase().includes(recherche.toLowerCase())) continue;
      const liste = parNom.get(s.nom) ?? [];
      liste.push(s);
      parNom.set(s.nom, liste);
    }
    return [...parNom.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sites, recherche]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/repertoire"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href={`/repertoire/clients/export?horsContrat=${horsContrat ? 1 : 0}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter en Excel"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href="/repertoire/clients/importer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer un fichier"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href={`/repertoire/clients/nouveau${horsContrat ? "?horsContrat=1" : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Ajouter
            </Link>
          </div>
        )}
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {horsContrat ? "Clients hors contrat" : "Clients sous contrat"}
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        {groupes.length} client(s) — {sites.length} site(s)
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {groupes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Aucun client trouvé
        </p>
      ) : (
        <ul className="space-y-3">
          {groupes.map(([nom, sitesDuClient]) => (
            <li key={nom}>
              <Link
                href={
                  sitesDuClient.length === 1
                    ? `/repertoire/clients/${sitesDuClient[0].id}`
                    : `/repertoire/clients/groupe/${encodeURIComponent(nom)}?horsContrat=${horsContrat ? 1 : 0}`
                }
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    horsContrat ? "bg-orange-100" : "bg-green-100"
                  }`}
                >
                  <Building2
                    className={`h-5 w-5 ${
                      horsContrat ? "text-orange-600" : "text-brand-green-dark"
                    }`}
                    strokeWidth={2}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                  {nom}
                </span>
                <span className="shrink-0 text-sm text-slate-400">
                  {sitesDuClient.length} site(s)
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

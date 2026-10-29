"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, Upload, Download } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Adresse" },
  { titre: "Complément" },
  { titre: "CP", largeur: "90px" },
  { titre: "Commune" },
  { titre: "Payeur" },
  { titre: "N° affaire", largeur: "110px" },
  { titre: "Lots" },
];

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

  const nbClients = useMemo(() => new Set(sites.map((s) => s.nom)).size, [sites]);

  const filtres = useMemo(() => {
    const cible = recherche.toLowerCase();
    return sites
      .filter(
        (s) =>
          s.nom.toLowerCase().includes(cible) ||
          s.adresse.toLowerCase().includes(cible) ||
          s.commune.toLowerCase().includes(cible) ||
          s.n_affaire.toLowerCase().includes(cible) ||
          s.site.toLowerCase().includes(cible),
      )
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.site.localeCompare(b.site, "fr"));
  }, [sites, recherche]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {horsContrat ? "Clients hors contrat" : "Clients sous contrat"}
          </h1>
          <p className="text-sm text-slate-500">
            {nbClients} client(s) — {sites.length} site(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
            <Link
              href="/repertoire/clients"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                !horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sous contrat
            </Link>
            <Link
              href="/repertoire/clients?horsContrat=1"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Hors contrat
            </Link>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Rechercher un client..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-56 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          {isAdmin && (
            <>
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
            </>
          )}
        </div>
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((s) => [
          s.adresse,
          s.complement_adresse,
          s.code_postal,
          s.commune,
          <Link
            key="payeur"
            href={`/repertoire/clients/groupe/${encodeURIComponent(s.nom)}?horsContrat=${horsContrat ? 1 : 0}`}
            className="font-bold text-slate-900 hover:underline"
          >
            {s.nom}
          </Link>,
          s.n_affaire,
          <Link key="lots" href={`/repertoire/clients/${s.id}`} className="text-brand-green-dark hover:underline">
            {s.site || "—"}
          </Link>,
        ])}
        valeurs={filtres.map((s) => [s.adresse, s.complement_adresse, s.code_postal, s.commune, s.nom, s.n_affaire, s.site])}
        vide="Aucun client trouvé"
      />
    </div>
  );
}

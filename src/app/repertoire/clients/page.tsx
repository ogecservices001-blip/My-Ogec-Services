"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Search, ChevronRight, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Site } from "@/lib/types";

function ClientsListeInner() {
  const searchParams = useSearchParams();
  const horsContrat = searchParams.get("horsContrat") === "1";

  const [sites, setSites] = useState<Site[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sites_view")
      .select("*")
      .eq("hors_contrat", horsContrat)
      .order("nom")
      .then(({ data }) => {
        setSites((data as Site[]) ?? []);
        setChargement(false);
      });
  }, [horsContrat]);

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
      <Link
        href="/repertoire"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {horsContrat ? "Clients hors contrat" : "Clients contrat entretien"}
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        {chargement
          ? "Chargement..."
          : `${groupes.length} client(s) — ${sites.length} site(s)`}
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {chargement ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </div>
      ) : groupes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Aucun client trouvé
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {groupes.map(([nom, sitesDuClient], i) => (
            <li
              key={nom}
              className={i > 0 ? "border-t border-slate-100" : ""}
            >
              <Link
                href={
                  sitesDuClient.length === 1
                    ? `/repertoire/clients/${sitesDuClient[0].id}`
                    : `/repertoire/clients/groupe/${encodeURIComponent(nom)}?horsContrat=${horsContrat ? 1 : 0}`
                }
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <Building2 className="h-4 w-4 text-slate-500" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
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

export default function ClientsListePage() {
  return (
    <Suspense>
      <ClientsListeInner />
    </Suspense>
  );
}

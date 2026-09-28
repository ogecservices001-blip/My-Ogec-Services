"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          {horsContrat ? "Clients hors contrat" : "Clients contrat entretien"}
        </h1>
      </div>
      <input
        placeholder="Rechercher un client..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {chargement ? (
        <p className="text-slate-500">Chargement...</p>
      ) : groupes.length === 0 ? (
        <p className="text-slate-500">Aucun client trouvé</p>
      ) : (
        <ul className="space-y-2">
          {groupes.map(([nom, sitesDuClient]) => (
            <li key={nom}>
              <Link
                href={
                  sitesDuClient.length === 1
                    ? `/repertoire/clients/${sitesDuClient[0].id}`
                    : `/repertoire/clients/groupe/${encodeURIComponent(nom)}?horsContrat=${horsContrat ? 1 : 0}`
                }
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <span className="font-medium text-slate-900">{nom}</span>
                <span className="text-sm text-slate-500">
                  {sitesDuClient.length} site(s)
                </span>
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

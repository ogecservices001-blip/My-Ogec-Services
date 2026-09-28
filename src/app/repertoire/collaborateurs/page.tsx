"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Phone, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profil } from "@/lib/types";

function initiales(nom: string) {
  const parts = nom.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function CollaborateursPage() {
  const [profils, setProfils] = useState<Profil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setProfils((data as Profil[]) ?? []);
        setChargement(false);
      });
  }, []);

  const filtres = useMemo(
    () =>
      profils.filter((p) =>
        p.name.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [profils, recherche],
  );

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
        Annuaire collaborateurs
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        {chargement ? "Chargement..." : `${filtres.length} collaborateur(s)`}
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un collègue..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {chargement ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {filtres.map((p, i) => (
            <li key={p.id} className={i > 0 ? "border-t border-slate-100" : ""}>
              <button
                onClick={() => setOuvert(ouvert === p.id ? null : p.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {initiales(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                  {p.name}
                </span>
                {p.portable && (
                  <a
                    href={`tel:${p.portable}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-brand-green-dark transition hover:bg-brand-green/10"
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                    {p.portable}
                  </a>
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-300 transition ${
                    ouvert === p.id ? "rotate-180" : ""
                  }`}
                />
              </button>
              {ouvert === p.id && (
                <div className="space-y-1.5 border-t border-slate-50 bg-slate-50/50 px-4 py-3 pl-16 text-sm text-slate-600">
                  {p.email_perso && <p>Email personnel : {p.email_perso}</p>}
                  {p.commune_habitation && (
                    <p>Commune : {p.commune_habitation}</p>
                  )}
                  {p.vehicule && <p>Véhicule : {p.vehicule}</p>}
                  {p.qualite && <p>Qualité : {p.qualite}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

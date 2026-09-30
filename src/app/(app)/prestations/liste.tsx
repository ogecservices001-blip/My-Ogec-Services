"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ClipboardList } from "lucide-react";
import { labelNatureDevis } from "@/lib/devis/constants";

export type PrestationLigne = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  nature: string;
  libelle: string;
  montant: number | null;
  heuresPrevues: number | null;
  dateCommandeClient: string;
  biNumero: string | null;
  realisee: boolean;
  annulee: boolean;
};

type Onglet = "a_realiser" | "realisees" | "annulees";

export function PrestationsListe({ lignes }: { lignes: PrestationLigne[] }) {
  const [onglet, setOnglet] = useState<Onglet>("a_realiser");
  const [recherche, setRecherche] = useState("");

  const aRealiser = lignes.filter((l) => !l.annulee && !l.realisee);
  const realisees = lignes.filter((l) => !l.annulee && l.realisee);
  const annulees = lignes.filter((l) => l.annulee);
  const parOnglet: Record<Onglet, PrestationLigne[]> = { a_realiser: aRealiser, realisees, annulees };
  const filtrees = parOnglet[onglet].filter((l) =>
    `${l.clientNom} ${l.clientSite} ${l.libelle}`.toLowerCase().includes(recherche.toLowerCase()),
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Prestation sur commande</h1>
      <p className="mb-5 text-sm text-slate-500">Devis commandés — suivi de la réalisation</p>

      <div className="mb-4 flex flex-col gap-2">
        <button
          onClick={() => setOnglet("a_realiser")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "a_realiser" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          À réaliser ({aRealiser.length})
        </button>
        <button
          onClick={() => setOnglet("realisees")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "realisees" ? "bg-brand-green text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Réalisées ({realisees.length})
        </button>
        <button
          onClick={() => setOnglet("annulees")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "annulees" ? "bg-red-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Annulées ({annulees.length})
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client, un site..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {filtrees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {onglet === "a_realiser"
            ? "Aucune prestation à réaliser"
            : onglet === "realisees"
              ? "Aucune prestation réalisée"
              : "Aucune prestation annulée"}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {filtrees.map((l) => (
            <li key={l.id} className={`rounded-2xl bg-white p-4 shadow-sm ${l.annulee ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">
                    {[l.clientNom, l.clientSite].filter(Boolean).join(" — ")}
                  </p>
                  {l.libelle && <p className="mt-0.5 text-sm text-slate-700">{l.libelle}</p>}
                </div>
                {l.nature && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    {labelNatureDevis(l.nature)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{l.numero}</span>
                {l.dateCommandeClient && <span>Commandé le {l.dateCommandeClient}</span>}
                {l.heuresPrevues !== null && <span>{l.heuresPrevues} h prévues</span>}
                {l.montant !== null && <span>{l.montant.toFixed(2)} €</span>}
              </div>
              {l.biNumero && (
                <Link
                  href="/bi"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                >
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  {l.biNumero}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

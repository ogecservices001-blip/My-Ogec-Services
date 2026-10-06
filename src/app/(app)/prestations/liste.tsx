"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ClipboardList, Wrench, Download } from "lucide-react";
import { labelNatureDevis } from "@/lib/devis/constants";
import { avecAffaire } from "@/lib/bi/constants";
import { Tableur } from "@/components/tableur";
import { FiltreSelect } from "@/components/filtre-select";
import type { PrestationLigne } from "@/lib/prestations/charger-lignes";

export function PrestationsListe({
  lignes,
  isAdmin,
  vue,
}: {
  lignes: PrestationLigne[];
  isAdmin: boolean;
  vue: "a_realiser" | "realisees" | "annulees";
}) {
  const [recherche, setRecherche] = useState("");

  const parVue: Record<typeof vue, PrestationLigne[]> = {
    a_realiser: lignes.filter((l) => !l.annulee && !l.realisee),
    realisees: lignes.filter((l) => !l.annulee && l.realisee),
    annulees: lignes.filter((l) => l.annulee),
  };
  const [client, setClient] = useState("");
  const clients = [...new Set(parVue[vue].map((l) => l.clientNom).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const filtrees = parVue[vue].filter(
    (l) =>
      (!client || l.clientNom === client) &&
      `${l.clientNom} ${l.clientSite} ${l.libelle}`.toLowerCase().includes(recherche.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {vue === "a_realiser" ? "Prestation sur commande" : vue === "realisees" ? "Prestations réalisées" : "Prestations annulées"}
        </h1>
        {isAdmin && (
          <a
            href="/prestations/export"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            title="Exporter en Excel"
          >
            <Download className="h-4 w-4" strokeWidth={2.25} />
          </a>
        )}
      </div>
      <p className="mb-5 text-sm text-slate-500">Devis commandés — Suivi de la réalisation</p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client, un site..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {vue !== "a_realiser" ? (
        <>
        <div className="mb-3 flex justify-end">
          <FiltreSelect
            valeur={client}
            onChange={setClient}
            toutes="Tous les clients"
            options={clients.map((c) => ({ valeur: c, label: c }))}
          />
        </div>
        <Tableur
          colonnes={[
            { titre: "N°", largeur: "9%" },
            { titre: "Client — Site", largeur: "20%" },
            { titre: "Libellé", largeur: "26%" },
            { titre: "Nature", largeur: "8%" },
            { titre: "Commandé le", largeur: "10%" },
            { titre: "H. prévues", largeur: "8%", droite: true },
            { titre: "Montant", largeur: "10%", droite: true },
            { titre: "N° BI", largeur: "9%" },
          ]}
          lignes={filtrees.map((l) => [
            l.numero,
            [l.clientNom, l.clientSite].filter(Boolean).join(" — "),
            l.libelle,
            labelNatureDevis(l.nature) || "—",
            l.dateCommandeClient,
            l.heuresPrevues !== null ? String(l.heuresPrevues) : "",
            l.montant !== null
              ? `${l.montant.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
              : "",
            l.biId && l.biNumero ? (
              <Link key="bi" href={`/bi/${l.biId}`} className="font-semibold text-violet-700 hover:underline">
                {l.biNumero}
              </Link>
            ) : (
              (l.biNumero ?? "")
            ),
          ])}
          vide={vue === "realisees" ? "Aucune prestation réalisée" : "Aucune prestation annulée"}
        />
        </>
      ) : filtrees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucune prestation à réaliser</p>
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
                {isAdmin && l.montant !== null && <span>{l.montant.toFixed(2)} €</span>}
              </div>
              {l.biNumero && l.biId && (
                <Link
                  href={`/bi/${l.biId}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                >
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  {l.biNumero}
                </Link>
              )}
              {l.biNumero && !l.biId && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  {l.biNumero} (historique)
                </span>
              )}
              {vue === "a_realiser" && !isAdmin && avecAffaire(l.nature) && (
                <Link
                  href={`/bi/nouveau?devisId=${l.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                >
                  <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                  Créer le BI
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

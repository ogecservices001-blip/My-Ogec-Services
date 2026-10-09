"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Download } from "lucide-react";
import { Tableur } from "@/components/tableur";
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
      <Link
        href="/devis"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <DevisEntete isAdmin={isAdmin} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/devis"
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Chrono Devis
        </Link>
        <Link
          href="/devis/par-client"
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            !horsContrat ? "bg-brand-green text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Clients sous contrat
        </Link>
        <Link
          href="/devis/par-client?horsContrat=1"
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            horsContrat ? "bg-orange-500 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Clients hors contrat
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      <Tableur
          colonnes={[
            { titre: "Client", largeur: "30%" },
            { titre: "Sites", largeur: "8%", droite: true },
            { titre: "Devis", largeur: "8%", droite: true },
            { titre: "Commandés", largeur: "10%", droite: true },
            ...(isAdmin
              ? [
                  { titre: "Montant total", largeur: "14%", droite: true },
                  { titre: "En attente", largeur: "14%", droite: true },
                  { titre: "", largeur: "6%" },
                ]
              : []),
          ]}
          lignes={filtres.map((g) => [
            <Link
              key="nom"
              href={
                g.sites.length === 1
                  ? `/devis/site/${g.sites[0].id}`
                  : `/devis/groupe/${encodeURIComponent(g.nom)}?horsContrat=${horsContrat ? 1 : 0}`
              }
              className="font-semibold text-slate-900 hover:underline"
            >
              {g.nom}
            </Link>,
            String(g.sites.length),
            String(g.nbDevis),
            String(g.nbCommandes),
            ...(isAdmin
              ? [
                  eur(g.montantTotal),
                  eur(g.montantTotal - g.montantCommande),
                  <a
                    key="export"
                    href={`/devis/export?nom=${encodeURIComponent(g.nom)}`}
                    className="inline-flex rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                    title={`Exporter les devis de ${g.nom}`}
                  >
                    <Download className="h-4 w-4" strokeWidth={2} />
                  </a>,
                ]
              : []),
          ])}
          valeurs={filtres.map((g) => [g.nom])}
          vide={groupes.length === 0 ? "Aucun devis pour l'instant — « Importer » pour commencer" : "Aucun résultat"}
        />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, FileSignature, Upload, Download } from "lucide-react";
import { TableauRegistreDevis, eur, type DevisRegistreLigne } from "./registre-liste";

export type { DevisRegistreLigne };

export type ClientGroupe = {
  nom: string;
  sites: { id: string; site: string; nbDevis: number }[];
  nbDevis: number;
  nbCommandes: number;
  montantTotal: number;
  montantCommande: number;
};

export function DevisClientsListe({
  groupes,
  registre,
  horsContrat,
  isAdmin,
}: {
  groupes: ClientGroupe[];
  registre: DevisRegistreLigne[];
  horsContrat: boolean;
  isAdmin: boolean;
}) {
  const [vue, setVue] = useState<"client" | "registre">("registre");
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () => groupes.filter((g) => g.nom.toLowerCase().includes(recherche.toLowerCase())),
    [groupes, recherche],
  );

  const registreFiltre = useMemo(
    () =>
      registre.filter(
        (d) =>
          d.clientNom.toLowerCase().includes(recherche.toLowerCase()) ||
          d.numero.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [registre, recherche],
  );

  const statsGlobales = useMemo(() => {
    const actifs = registre.filter((d) => !d.annule);
    const commandes = actifs.filter((d) => d.commande);
    return {
      nbDevis: actifs.length,
      nbCommandes: commandes.length,
      montantTotal: actifs.reduce((s, d) => s + (d.montant ?? 0), 0),
      montantCommande: commandes.reduce((s, d) => s + (d.montant ?? 0), 0),
    };
  }, [registre]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Devis</h1>
          <p className="text-sm text-slate-500">Registre complet — devis en attente et commandés</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href="/devis/export"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter tous les devis"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href="/devis/importer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer des devis"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/devis"
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            !horsContrat ? "bg-brand-green text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Clients sous contrat
        </Link>
        <Link
          href="/devis?horsContrat=1"
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            horsContrat ? "bg-orange-500 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Clients hors contrat
        </Link>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button
          onClick={() => setVue("registre")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            vue === "registre" ? "bg-sky-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Chrono Devis
        </button>
        <button
          onClick={() => setVue("client")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            vue === "client" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Par client
        </button>
      </div>

      {vue === "registre" && (
        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-bold text-slate-900">{statsGlobales.nbDevis}</p>
            <p className="text-xs text-slate-500">Devis</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-bold text-brand-green-dark">
              {statsGlobales.nbCommandes}
              <span className="text-sm font-semibold text-slate-400">
                {" "}
                /{statsGlobales.nbDevis > 0 ? Math.round((statsGlobales.nbCommandes / statsGlobales.nbDevis) * 100) : 0}%
              </span>
            </p>
            <p className="text-xs text-slate-500">Commandés</p>
          </div>
          {isAdmin && (
            <>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-lg font-bold text-slate-900">{eur(statsGlobales.montantTotal)}</p>
                <p className="text-xs text-slate-500">Montant total</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-lg font-bold text-amber-600">
                  {eur(statsGlobales.montantTotal - statsGlobales.montantCommande)}
                </p>
                <p className="text-xs text-slate-500">En attente</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder={vue === "client" ? "Rechercher un client..." : "Rechercher un client ou un n° de devis..."}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {vue === "client" ? (
        filtres.length === 0 ? (
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
        )
      ) : registreFiltre.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {registre.length === 0 ? "Aucun devis pour l'instant" : "Aucun résultat"}
        </p>
      ) : (
        <TableauRegistreDevis lignes={registreFiltre} isAdmin={isAdmin} />
      )}
    </div>
  );
}

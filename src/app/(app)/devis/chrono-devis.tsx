"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DevisEntete } from "./entete";
import { TableauRegistreDevis, eur, type DevisRegistreLigne } from "./registre-liste";

export function ChronoDevis({
  registre,
  isAdmin,
}: {
  registre: DevisRegistreLigne[];
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [client, setClient] = useState("");
  const [statut, setStatut] = useState<"" | "attente" | "commande" | "annule">("");

  const clients = useMemo(
    () => [...new Set(registre.map((d) => d.clientNom).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [registre],
  );

  const registreFiltre = useMemo(
    () =>
      registre.filter((d) => {
        if (client && d.clientNom !== client) return false;
        if (statut === "attente" && (d.annule || d.commande)) return false;
        if (statut === "commande" && (d.annule || !d.commande)) return false;
        if (statut === "annule" && !d.annule) return false;
        return (
          d.clientNom.toLowerCase().includes(recherche.toLowerCase()) ||
          d.numero.toLowerCase().includes(recherche.toLowerCase())
        );
      }),
    [registre, recherche, client, statut],
  );

  const stats = useMemo(() => {
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
      <DevisEntete isAdmin={isAdmin} />

      <div className="mb-5">
        <Link
          href="/devis/par-client"
          className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Par client
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-slate-900">{stats.nbDevis}</p>
          <p className="text-xs text-slate-500">Devis</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-brand-green-dark">
            {stats.nbCommandes}
            <span className="text-sm font-semibold text-slate-400">
              {" "}
              /{stats.nbDevis > 0 ? Math.round((stats.nbCommandes / stats.nbDevis) * 100) : 0}%
            </span>
          </p>
          <p className="text-xs text-slate-500">Commandés</p>
        </div>
        {isAdmin && (
          <>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-lg font-bold text-slate-900">{eur(stats.montantTotal)}</p>
              <p className="text-xs text-slate-500">Montant total</p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-lg font-bold text-amber-600">{eur(stats.montantTotal - stats.montantCommande)}</p>
              <p className="text-xs text-slate-500">En attente</p>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Rechercher un client ou un n° de devis..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </div>
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value as typeof statut)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        >
          <option value="">Tous les statuts</option>
          <option value="attente">En attente</option>
          <option value="commande">Commandé</option>
          <option value="annule">Annulée</option>
        </select>
      </div>

      {registreFiltre.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {registre.length === 0 ? "Aucun devis pour l'instant" : "Aucun résultat"}
        </p>
      ) : (
        <TableauRegistreDevis lignes={registreFiltre} isAdmin={isAdmin} />
      )}
    </div>
  );
}

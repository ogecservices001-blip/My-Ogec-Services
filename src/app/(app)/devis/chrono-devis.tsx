"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DevisEntete } from "./entete";
import { TableauRegistreDevis, eur, type DevisRegistreLigne } from "./registre-liste";

export function ChronoDevis({
  registre,
  isAdmin,
}: {
  registre: DevisRegistreLigne[];
  isAdmin: boolean;
}) {
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

      {registre.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun devis pour l&apos;instant</p>
      ) : (
        <TableauRegistreDevis lignes={registre} isAdmin={isAdmin} />
      )}
    </div>
  );
}

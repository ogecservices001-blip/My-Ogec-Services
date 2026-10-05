"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DevisEntete, DevisVueToggle } from "./entete";
import { TableauRegistreDevis, eur, type DevisRegistreLigne } from "./registre-liste";

export function ChronoDevis({
  registre,
  isAdmin,
}: {
  registre: DevisRegistreLigne[];
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");

  const registreFiltre = useMemo(
    () =>
      registre.filter(
        (d) =>
          d.clientNom.toLowerCase().includes(recherche.toLowerCase()) ||
          d.numero.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [registre, recherche],
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

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DevisVueToggle vueActive="registre" />
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

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un client ou un n° de devis..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
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

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";

export type DevisValide = { id: string; numero: string; clientNom: string; libelle: string };

const COLONNES: ColonneTableur[] = [
  { titre: "N°", largeur: "16%" },
  { titre: "Client — Site", largeur: "28%" },
  { titre: "Libellé", largeur: "36%" },
  { titre: "", largeur: "20%" },
];

export function CreerCommandeListe({ devis }: { devis: DevisValide[] }) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () =>
      devis.filter((d) => {
        const cible = recherche.toLowerCase();
        return d.numero.toLowerCase().includes(cible) || d.clientNom.toLowerCase().includes(cible) || d.libelle.toLowerCase().includes(cible);
      }),
    [devis, recherche],
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Créer une commande</h1>
      <p className="mb-5 text-sm text-slate-500">Choisis le devis validé concerné — {filtres.length} devis</p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un n° de devis, un client, un libellé..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((d) => [
          <span key="numero" className="font-bold text-slate-900">
            {d.numero}
          </span>,
          d.clientNom,
          d.libelle,
          <Link
            key="action"
            href={`/commandes-fournisseur/nouveau?devisId=${d.id}`}
            className="inline-flex rounded-lg bg-brand-green px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
          >
            + Commande
          </Link>,
        ])}
        valeurs={filtres.map((d) => [d.numero])}
        vide="Aucun devis validé pour l'instant"
      />
    </div>
  );
}

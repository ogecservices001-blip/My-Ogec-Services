"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { calculerTotaux, eur, type LigneCommande } from "@/lib/commandes-fournisseur/format";

export type CommandeResume = {
  id: string;
  numero: string;
  fournisseurNom: string;
  devisNumero: string;
  clientNom: string;
  dateCommande: string;
  lignes: unknown;
  tauxTva: number;
  livre: boolean;
  envoyeeLe: string;
};

const COLONNES: ColonneTableur[] = [
  { titre: "N°", largeur: "16%" },
  { titre: "Fournisseur", largeur: "18%" },
  { titre: "Affaire", largeur: "22%" },
  { titre: "Date", largeur: "10%" },
  { titre: "Montant TTC", largeur: "14%", droite: true },
  { titre: "Envoyée", largeur: "10%" },
  { titre: "Livré", largeur: "10%" },
];

export function CommandesFournisseurListe({ commandes }: { commandes: CommandeResume[] }) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () =>
      commandes.filter((c) => {
        const cible = recherche.toLowerCase();
        return (
          c.numero.toLowerCase().includes(cible) ||
          c.fournisseurNom.toLowerCase().includes(cible) ||
          c.clientNom.toLowerCase().includes(cible)
        );
      }),
    [commandes, recherche],
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Commandes fournisseur</h1>
      <p className="mb-5 text-sm text-slate-500">{filtres.length} commande(s)</p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un n°, un fournisseur, un client..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((c) => {
          const totaux = calculerTotaux((c.lignes as LigneCommande[]) ?? [], c.tauxTva);
          return [
            <Link key="numero" href={`/commandes-fournisseur/${c.id}`} className="font-bold text-slate-900 hover:underline">
              {c.numero}
            </Link>,
            c.fournisseurNom,
            [c.devisNumero, c.clientNom].filter(Boolean).join(" — "),
            c.dateCommande,
            eur(totaux.ttc),
            c.envoyeeLe ? c.envoyeeLe : "—",
            c.livre ? "Oui" : "Non",
          ];
        })}
        vide="Aucune commande fournisseur pour l'instant"
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { HeuresAnnee } from "@/lib/gmao/calcul-heures-visite";

export type ClientGroupe = {
  nom: string;
  siteIds: string[];
  nbSites: number;
  heures: HeuresAnnee;
  /// Non-null quand ce client n'a qu'un seul site — on saute alors
  /// directement au parc, sans passer par le sélecteur de site.
  siteUniqueId: string | null;
};

export function GmaoClientsListe({
  groupes,
  horsContrat,
  titre,
}: {
  groupes: ClientGroupe[];
  horsContrat: boolean;
  titre: string;
}) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () => groupes.filter((g) => g.nom.toLowerCase().includes(recherche.toLowerCase())),
    [groupes, recherche],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{titre}</h1>
          <p className="text-sm text-slate-500">{filtres.length} client(s)</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Rechercher un client..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-56 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </div>
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((g) => [
          <Link
            key="nom"
            href={
              g.siteUniqueId
                ? `/gmao/clients/${g.siteUniqueId}/equipements`
                : `/gmao/clients/groupe/${encodeURIComponent(g.nom)}?horsContrat=${horsContrat ? 1 : 0}`
            }
            className="font-bold text-slate-900 hover:underline"
          >
            {g.nom}
          </Link>,
          g.nbSites,
          g.heures.prevues.heuresTech || "",
          g.heures.prevues.heuresAssistant || "",
        ])}
        valeurs={filtres.map((g) => [g.nom])}
        vide="Aucun client trouvé"
      />
    </div>
  );
}

const COLONNES: ColonneTableur[] = [
  { titre: "Client" },
  { titre: "Sites", largeur: "90px", droite: true },
  { titre: "Heures Tech", largeur: "120px", droite: true },
  { titre: "Heures Assistant", largeur: "140px", droite: true },
];

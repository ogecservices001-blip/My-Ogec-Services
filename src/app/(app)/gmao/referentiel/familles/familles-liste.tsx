"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { TypeEquipement } from "@/lib/gmao/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Nom" },
  { titre: "Code", largeur: "100px" },
  { titre: "Opérations", droite: true, largeur: "110px" },
  { titre: "Groupes de mesures", droite: true, largeur: "150px" },
];

export function FamillesListe({ familles }: { familles: TypeEquipement[] }) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () =>
      familles.filter(
        (f) =>
          f.nom.toLowerCase().includes(recherche.toLowerCase()) ||
          f.code.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [familles, recherche],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Référentiel équipements (GMAO)</h1>
          <p className="text-sm text-slate-500">{filtres.length} famille(s)</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Rechercher une famille..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-56 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </div>
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((f) => [
          <Link key="nom" href={`/gmao/referentiel/familles/${f.id}`} className="font-bold text-slate-900 hover:underline">
            {f.nom}
          </Link>,
          f.code,
          f.checklist.length,
          f.groupes_mesures.length,
        ])}
        valeurs={filtres.map((f) => [f.nom, f.code])}
        vide="Aucune famille trouvée"
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { BiListe } from "../liste";

type BonResume = {
  id: string;
  numero: string;
  statut: string;
  pole: string;
  client_nom: string;
  site: string;
  equipement_nom: string;
  equipement_localisation: string;
  updated_at: string;
  classement: string;
};

type Onglet = "a_classer" | "archiver" | "facturer";

const TITRES: Record<Onglet, string> = {
  a_classer: "À classer",
  archiver: "Archivage chantier",
  facturer: "À facturer",
};

export function BiValidesOnglets({ bons }: { bons: BonResume[] }) {
  const [onglet, setOnglet] = useState<Onglet>("a_classer");

  const parOnglet: Record<Onglet, BonResume[]> = {
    a_classer: bons.filter((b) => !b.classement),
    archiver: bons.filter((b) => b.classement === "archiver"),
    facturer: bons.filter((b) => b.classement === "facturer"),
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(TITRES) as Onglet[]).map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              onglet === o
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            {TITRES[o]} ({parOnglet[o].length})
          </button>
        ))}
      </div>
      <BiListe
        bons={parOnglet[onglet]}
        titre={TITRES[onglet]}
        vide={onglet === "a_classer" ? "Aucun bon à classer" : onglet === "archiver" ? "Aucun bon archivé" : "Aucun bon à facturer"}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { BiListe } from "../liste";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { labelPole } from "@/lib/bi/constants";
import { eur } from "@/lib/bi/format";

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
  mois_facturation: string;
  montantHt: number;
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
      {onglet === "facturer" ? (
        <BiFacturerListe bons={parOnglet.facturer} />
      ) : (
        <BiListe
          bons={parOnglet[onglet]}
          titre={TITRES[onglet]}
          vide={onglet === "a_classer" ? "Aucun bon à classer" : "Aucun bon archivé"}
        />
      )}
    </div>
  );
}

const COLONNES_FACTURER: ColonneTableur[] = [
  { titre: "N°", largeur: "12%" },
  { titre: "Client — Site", largeur: "22%" },
  { titre: "Équipement", largeur: "16%" },
  { titre: "Pôle", largeur: "16%" },
  { titre: "Mois facturation", largeur: "12%" },
  { titre: "Montant HT", largeur: "12%", droite: true },
  { titre: "Statut", largeur: "10%" },
];

function BiFacturerListe({ bons }: { bons: BonResume[] }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">À facturer</h1>
        <p className="text-sm text-slate-500">Petits travaux, maintenance, dépannage</p>
      </div>
      <Tableur
        colonnes={COLONNES_FACTURER}
        lignes={bons.map((b) => [
          <Link key="numero" href={`/bi/${b.id}`} className="font-bold text-slate-900 hover:underline">
            {b.numero || "BI (brouillon)"}
          </Link>,
          [b.client_nom, b.site].filter(Boolean).join(" — "),
          [b.equipement_nom, b.equipement_localisation].filter(Boolean).join(" — "),
          `Pôle ${b.pole} · ${labelPole(b.pole)}`,
          b.mois_facturation || "",
          eur(b.montantHt),
          b.mois_facturation ? (
            <span key="statut" className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
              Facturable
            </span>
          ) : (
            <span key="statut" className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
              Mois à définir
            </span>
          ),
        ])}
        valeurs={bons.map((b) => [b.numero || "BI (brouillon)", undefined, undefined, undefined, undefined, undefined, b.mois_facturation ? "Facturable" : "Mois à définir"])}
        vide="Aucun bon à facturer"
      />
    </div>
  );
}

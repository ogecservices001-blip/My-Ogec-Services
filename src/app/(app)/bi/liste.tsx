"use client";

import Link from "next/link";
import { StatutBadge } from "@/components/bi/statut-badge";
import { Tableur } from "@/components/tableur";
import { labelPole } from "@/lib/bi/constants";

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
};

const COLONNES = [
  { titre: "N°", largeur: "12%" },
  { titre: "Client — Site", largeur: "22%" },
  { titre: "Équipement", largeur: "18%" },
  { titre: "Pôle", largeur: "18%" },
  { titre: "Statut", largeur: "16%" },
  { titre: "Mis à jour le", largeur: "14%" },
];

export function BiListe({ bons, titre, vide }: { bons: BonResume[]; titre: string; vide: string }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{titre}</h1>
        <p className="text-sm text-slate-500">Petits travaux, maintenance, dépannage</p>
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={bons.map((b) => [
          <Link key="numero" href={`/bi/${b.id}`} className="font-bold text-slate-900 hover:underline">
            {b.numero || "BI (brouillon)"}
          </Link>,
          [b.client_nom, b.site].filter(Boolean).join(" — "),
          [b.equipement_nom, b.equipement_localisation].filter(Boolean).join(" — "),
          `Pôle ${b.pole} · ${labelPole(b.pole)}`,
          <StatutBadge key="statut" statut={b.statut} />,
          new Date(b.updated_at).toLocaleDateString("fr-FR"),
        ])}
        vide={vide}
      />
    </div>
  );
}

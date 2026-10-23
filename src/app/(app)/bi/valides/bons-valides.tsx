"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { StatutBadge } from "@/components/bi/statut-badge";
import { CLASSEMENT_LABELS, labelPole, labelStatut } from "@/lib/bi/constants";
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

const COULEUR_CLASSEMENT: Record<string, string> = {
  archiver: "bg-slate-100 text-slate-600",
  facturer: "bg-teal-100 text-teal-700",
  reception_travaux: "bg-blue-100 text-blue-700",
  maintenance: "bg-violet-100 text-violet-700",
};

function labelClassement(classement: string): string {
  return CLASSEMENT_LABELS[classement] ?? "Non classé";
}

const COLONNES: ColonneTableur[] = [
  { titre: "N°", largeur: "8%" },
  { titre: "Client", largeur: "14%" },
  { titre: "Site", largeur: "14%" },
  { titre: "Équipement", largeur: "14%" },
  { titre: "Pôle", largeur: "12%" },
  { titre: "Classement", largeur: "10%" },
  { titre: "Mois facturation", largeur: "9%" },
  { titre: "Montant HT", largeur: "8%", droite: true },
  { titre: "Statut", largeur: "11%" },
];

/// Tous les bons validés, toutes catégories confondues, dans un seul
/// tableau façon classeur — le filtre par colonne (client, site, BI,
/// classement...) vient du composant Tableur lui-même, pas d'onglets
/// ni de sélecteur séparé.
export function BonsValidesTableau({ bons }: { bons: BonResume[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Bons validés</h1>
          <p className="text-sm text-slate-500">Petits travaux, maintenance, dépannage</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier, pas une page interne */}
        <a
          href="/bi/valides/export"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          title="Exporter en Excel (toutes les données)"
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
        </a>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={bons.map((b) => [
          <Link key="numero" href={`/bi/${b.id}`} className="font-bold text-slate-900 hover:underline">
            {b.numero || "BI (brouillon)"}
          </Link>,
          b.client_nom,
          b.site,
          [b.equipement_nom, b.equipement_localisation].filter(Boolean).join(" — "),
          `Pôle ${b.pole} · ${labelPole(b.pole)}`,
          <span
            key="classement"
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COULEUR_CLASSEMENT[b.classement] ?? "bg-amber-100 text-amber-700"}`}
          >
            {labelClassement(b.classement)}
          </span>,
          b.mois_facturation || "",
          eur(b.montantHt),
          <StatutBadge key="statut" statut={b.statut} />,
        ])}
        valeurs={bons.map((b) => [
          b.numero || "BI (brouillon)",
          b.client_nom,
          b.site,
          undefined,
          `Pôle ${b.pole} · ${labelPole(b.pole)}`,
          labelClassement(b.classement),
          b.mois_facturation || "",
          undefined,
          labelStatut(b.statut),
        ])}
        vide="Aucun bon validé"
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, Upload, ScanLine } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import type { ActionResult } from "@/lib/action-result";
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
  isAdmin,
  tousLesSiteIds,
  supprimerAction,
}: {
  groupes: ClientGroupe[];
  horsContrat: boolean;
  isAdmin: boolean;
  tousLesSiteIds: string[];
  supprimerAction: () => Promise<ActionResult>;
}) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () => groupes.filter((g) => g.nom.toLowerCase().includes(recherche.toLowerCase())),
    [groupes, recherche],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {horsContrat ? "GMAO — Clients hors contrat" : "GMAO — Clients sous contrat"}
          </h1>
          <p className="text-sm text-slate-500">{filtres.length} client(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
            <Link
              href="/gmao/clients?horsContrat=0"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                !horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sous contrat
            </Link>
            <Link
              href="/gmao/clients?horsContrat=1"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Hors contrat
            </Link>
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
          <Link
            href="/gmao/scanner"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            title="Scanner un QR code"
          >
            <ScanLine className="h-4 w-4" strokeWidth={2.25} />
          </Link>
          {isAdmin && (
            <>
              <a
                href={`/gmao/export?horsContrat=${horsContrat ? 1 : 0}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Exporter les équipements"
              >
                <Download className="h-4 w-4" strokeWidth={2.25} />
              </a>
              <Link
                href="/gmao/importer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Importer des équipements"
              >
                <Upload className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </>
          )}
        </div>
      </div>

      {isAdmin && tousLesSiteIds.length > 0 && (
        <div className="mb-4">
          <BoutonSupprimer
            action={supprimerAction}
            confirmation={`Supprime tous les équipements des ${groupes.length} client(s) ${
              horsContrat ? "hors contrat" : "sous contrat"
            } — action irréversible.`}
            redirectTo={`/gmao/clients?horsContrat=${horsContrat ? 1 : 0}`}
            label="Supprimer tout le parc de cette liste"
          />
        </div>
      )}

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

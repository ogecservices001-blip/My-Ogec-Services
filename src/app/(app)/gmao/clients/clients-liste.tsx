"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, Upload, ScanLine } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import type { ActionResult } from "@/lib/action-result";
import type { HeuresAnnee } from "@/lib/gmao/calcul-heures-visite";

export type LigneSiteGmao = {
  id: string;
  nom: string;
  site: string;
  adresse: string;
  complement_adresse: string;
  code_postal: string;
  commune: string;
  heures: HeuresAnnee;
};

const COLONNES: ColonneTableur[] = [
  { titre: "Payeur" },
  { titre: "Lots" },
  { titre: "CP", largeur: "90px" },
  { titre: "Commune" },
  { titre: "Adresse" },
  { titre: "Complément" },
  { titre: "Heures Tech", largeur: "110px", droite: true },
  { titre: "Heures Assistant", largeur: "140px", droite: true },
];

export function GmaoClientsListe({
  lignes,
  horsContrat,
  isAdmin,
  tousLesSiteIds,
  supprimerAction,
}: {
  lignes: LigneSiteGmao[];
  horsContrat: boolean;
  isAdmin: boolean;
  tousLesSiteIds: string[];
  supprimerAction: () => Promise<ActionResult>;
}) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(() => {
    const cible = recherche.toLowerCase();
    return lignes.filter(
      (l) =>
        l.nom.toLowerCase().includes(cible) ||
        l.site.toLowerCase().includes(cible) ||
        l.commune.toLowerCase().includes(cible) ||
        l.adresse.toLowerCase().includes(cible),
    );
  }, [lignes, recherche]);

  const nbClients = useMemo(() => new Set(filtres.map((l) => l.nom)).size, [filtres]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {horsContrat ? "GMAO — Clients hors contrat" : "GMAO — Clients sous contrat"}
          </h1>
          <p className="text-sm text-slate-500">
            {nbClients} client(s) — {filtres.length} site(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && tousLesSiteIds.length > 0 && (
            <BoutonSupprimer
              action={supprimerAction}
              confirmation={`Supprime tous les équipements des sites ${
                horsContrat ? "hors contrat" : "sous contrat"
              } (${lignes.length} site(s)) — action irréversible.`}
              redirectTo={`/gmao/clients?horsContrat=${horsContrat ? 1 : 0}`}
              label="Supprimer tout le parc de cette liste"
            />
          )}
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

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((l) => [
          <Link
            key="payeur"
            href={`/gmao/clients/groupe/${encodeURIComponent(l.nom)}?horsContrat=${horsContrat ? 1 : 0}`}
            className="font-bold text-slate-900 hover:underline"
          >
            {l.nom}
          </Link>,
          <Link key="site" href={`/gmao/clients/${l.id}/equipements`} className="text-brand-green-dark hover:underline">
            {l.site || "Site sans nom"}
          </Link>,
          l.code_postal,
          l.commune,
          l.adresse,
          l.complement_adresse,
          l.heures.prevues.heuresTech || "",
          l.heures.prevues.heuresAssistant || "",
        ])}
        valeurs={filtres.map((l) => [l.nom, l.site, l.code_postal, l.commune, l.adresse, l.complement_adresse])}
        vide="Aucun site trouvé"
      />
    </div>
  );
}

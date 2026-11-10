"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChoixClientSite } from "@/components/choix-client-site";
import { Plus, Upload, Download } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Payeur" },
  { titre: "Lots" },
  { titre: "CP", largeur: "90px" },
  { titre: "Commune" },
  { titre: "Adresse" },
  { titre: "Complément" },
  { titre: "N° affaire", largeur: "110px" },
];

export function ClientsListe({
  sites,
  horsContrat,
  isAdmin,
}: {
  sites: Site[];
  horsContrat: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [clientChoisi, setClientChoisi] = useState("");
  const sitesChoix = useMemo(() => sites.map((s) => ({ id: s.id, nom: s.nom, site: s.site })), [sites]);

  const nbClients = useMemo(() => new Set(sites.map((s) => s.nom)).size, [sites]);

  // Recherche : le choix Client | Site en tête de page la remplace.
  const filtres = sites;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {horsContrat ? "Clients hors contrat" : "Clients sous contrat"}
          </h1>
          <p className="text-sm text-slate-500">
            {nbClients} client(s) — {sites.length} site(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
            <Link
              href="/repertoire/clients"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                !horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sous contrat
            </Link>
            <Link
              href="/repertoire/clients?horsContrat=1"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Hors contrat
            </Link>
          </div>
          {isAdmin && (
            <>
              <a
                href={`/repertoire/clients/export?horsContrat=${horsContrat ? 1 : 0}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Exporter en Excel"
              >
                <Download className="h-4 w-4" strokeWidth={2.25} />
              </a>
              <Link
                href="/repertoire/clients/importer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Importer un fichier"
              >
                <Upload className="h-4 w-4" strokeWidth={2.25} />
              </Link>
              <Link
                href={`/repertoire/clients/nouveau${horsContrat ? "?horsContrat=1" : ""}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Ajouter
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Aller à la fiche d&apos;un site</p>
        <ChoixClientSite
          sites={sitesChoix}
          clientNom={clientChoisi}
          siteId=""
          idClient="repertoire-client"
          idSite="repertoire-site"
          obligatoire={false}
          onChange={(choix) => {
            setClientChoisi(choix.clientNom);
            if (choix.siteId) router.push(`/repertoire/clients/${choix.siteId}`);
          }}
        />
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((s) => [
          <Link
            key="payeur"
            href={`/repertoire/clients/groupe/${encodeURIComponent(s.nom)}?horsContrat=${horsContrat ? 1 : 0}`}
            className="font-bold text-slate-900 hover:underline"
          >
            {s.nom}
          </Link>,
          <Link key="lots" href={`/repertoire/clients/${s.id}`} className="text-brand-green-dark hover:underline">
            {s.site || "—"}
          </Link>,
          s.code_postal,
          s.commune,
          s.adresse,
          s.complement_adresse,
          s.n_affaire,
        ])}
        valeurs={filtres.map((s) => [s.nom, s.site, s.code_postal, s.commune, s.adresse, s.complement_adresse, s.n_affaire])}
        vide="Aucun client trouvé"
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { ChoixClientSite } from "@/components/choix-client-site";

export type SiteDepannage = {
  id: string;
  nom: string;
  site: string;
  code_postal: string;
  commune: string;
  adresse: string;
  complement_adresse: string;
};

const COLONNES: ColonneTableur[] = [
  { titre: "Payeur" },
  { titre: "Lots" },
  { titre: "CP", largeur: "90px" },
  { titre: "Commune" },
  { titre: "Adresse" },
  { titre: "Complément" },
];

/// Entrée du BI Dépannage, présentée comme la GMAO : on choisit le site
/// (Client | Site ou tableau), puis le BI s'ouvre avec client et site remplis.
export function ChoixSiteDepannage({ sites, horsContrat }: { sites: SiteDepannage[]; horsContrat: boolean }) {
  const router = useRouter();
  const [clientChoisi, setClientChoisi] = useState("");
  const nbClients = useMemo(() => new Set(sites.map((s) => s.nom)).size, [sites]);
  const lien = (siteId: string) => `/bi/nouveau?pole=60&horsContrat=${horsContrat ? 1 : 0}&siteId=${siteId}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {horsContrat ? "Dépannage — Clients hors contrat" : "Dépannage — Clients sous contrat"}
          </h1>
          <p className="text-sm text-slate-500">
            {nbClients} client(s) — {sites.length} site(s)
          </p>
        </div>
        <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
          <Link
            href="/bi/depannage?horsContrat=0"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              !horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Sous contrat
          </Link>
          <Link
            href="/bi/depannage?horsContrat=1"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              horsContrat ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Hors contrat
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Site du dépannage</p>
        <ChoixClientSite
          sites={sites}
          clientNom={clientChoisi}
          siteId=""
          idClient="depannage-bi-client"
          idSite="depannage-bi-site"
          obligatoire={false}
          onChange={(choix) => {
            setClientChoisi(choix.clientNom);
            if (choix.siteId) router.push(lien(choix.siteId));
          }}
        />
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={sites.map((s) => [
          <span key="payeur" className="font-bold text-slate-900">
            {s.nom}
          </span>,
          <Link key="site" href={lien(s.id)} className="font-semibold text-brand-green-dark hover:underline">
            {s.site || "Site sans nom"}
          </Link>,
          s.code_postal,
          s.commune,
          s.adresse,
          s.complement_adresse,
        ])}
        valeurs={sites.map((s) => [s.nom, s.site, s.code_postal, s.commune, s.adresse, s.complement_adresse])}
        vide="Aucun site"
      />
    </div>
  );
}

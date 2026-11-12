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

export type TicketOuvert = {
  id: string;
  numero: string;
  site_id: string;
  equipement_nom: string;
  message: string;
  brouillonId: string | null;
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
export function ChoixSiteDepannage({
  sites,
  horsContrat,
  ticketsOuverts = [],
}: {
  sites: SiteDepannage[];
  horsContrat: boolean;
  ticketsOuverts?: TicketOuvert[];
}) {
  const router = useRouter();
  const [clientChoisi, setClientChoisi] = useState("");
  const [siteAvecTickets, setSiteAvecTickets] = useState<string | null>(null);

  /// Un dépannage déjà enregistré se fait depuis son ticket (Dépannages en
  /// cours) ; sans ticket ouvert sur le site, on part directement.
  function choisirSite(siteId: string) {
    if (ticketsOuverts.some((t) => t.site_id === siteId)) setSiteAvecTickets(siteId);
    else router.push(lien(siteId));
  }
  const ticketsDuSite = ticketsOuverts.filter((t) => t.site_id === siteAvecTickets);
  const siteChoisi = sites.find((s) => s.id === siteAvecTickets);
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
            if (choix.siteId) choisirSite(choix.siteId);
          }}
        />
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={sites.map((s) => [
          <span key="payeur" className="font-bold text-slate-900">
            {s.nom}
          </span>,
          <button key="site" type="button" onClick={() => choisirSite(s.id)} className="text-left font-semibold text-brand-green-dark hover:underline">
            {s.site || "Site sans nom"}
          </button>,
          s.code_postal,
          s.commune,
          s.adresse,
          s.complement_adresse,
        ])}
        valeurs={sites.map((s) => [s.nom, s.site, s.code_postal, s.commune, s.adresse, s.complement_adresse])}
        vide="Aucun site"
      />

      {siteAvecTickets && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-slate-900">Dépannage en cours sur ce site</h2>
            <p className="mb-4 text-sm text-slate-600">
              {siteChoisi ? `${siteChoisi.nom} — ${siteChoisi.site}` : ""} a déjà {ticketsDuSite.length > 1 ? "des dépannages enregistrés" : "un dépannage enregistré"}.
              Fais le BI depuis le ticket pour qu&apos;il soit clôturé et apparaisse au planning.
            </p>
            <div className="mb-4 space-y-2">
              {ticketsDuSite.map((t) => (
                <div key={t.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-bold text-slate-900">
                    {t.numero}
                    {t.equipement_nom && <span className="font-normal text-slate-600"> — {t.equipement_nom}</span>}
                  </p>
                  {t.message && <p className="mb-2 line-clamp-2 text-xs text-slate-600">{t.message}</p>}
                  <Link
                    href={t.brouillonId ? `/bi/nouveau?brouillonId=${t.brouillonId}` : `/bi/nouveau?depannageId=${t.id}`}
                    className="inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    {t.brouillonId ? "Reprendre le BI de ce dépannage" : "Faire le BI de ce dépannage"}
                  </Link>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => setSiteAvecTickets(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <Link
                href={lien(siteAvecTickets)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 underline hover:text-slate-800"
              >
                C&apos;est une autre panne, continuer sans ticket
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

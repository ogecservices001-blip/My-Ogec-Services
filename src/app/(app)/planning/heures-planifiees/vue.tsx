"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { ChoixClientSite } from "@/components/choix-client-site";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { ResultatHeuresPlanifiees, TypeLigne } from "@/lib/planning/heures-planifiees";

const COLONNES: ColonneTableur[] = [
  { titre: "Type" },
  { titre: "Date(s)", largeur: "130px" },
  { titre: "Site" },
  { titre: "Détail" },
  { titre: "Techniciens" },
  { titre: "Heures prévues", droite: true, largeur: "120px" },
  { titre: "Heures réalisées", droite: true, largeur: "130px" },
  { titre: "État" },
];

const COULEUR: Record<TypeLigne, string> = {
  entretien: "bg-teal-100 text-teal-700",
  devis: "bg-emerald-100 text-emerald-700",
  depannage: "bg-red-100 text-red-700",
  autre: "bg-slate-100 text-slate-600",
};

const h = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`);
const jour = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

export function HeuresPlanifieesVue({
  sites,
  client,
  siteId,
  annee,
  resultat,
}: {
  sites: { id: string; nom: string; site: string }[];
  client: string;
  siteId: string;
  annee: number;
  resultat: ResultatHeuresPlanifiees | null;
}) {
  const router = useRouter();
  const aller = (c: string, s: string, a: number) => {
    const p = new URLSearchParams();
    if (c) p.set("client", c);
    if (s) p.set("site", s);
    p.set("annee", String(a));
    router.push(`/planning/heures-planifiees?${p.toString()}`);
  };
  const lienExport = `/planning/heures-planifiees/export?${new URLSearchParams({ client, site: siteId, annee: String(annee) }).toString()}`;
  const anneeCourante = new Date().getFullYear();
  const annees = Array.from({ length: 6 }, (_, i) => anneeCourante + 1 - i);

  return (
    <div>
      <Link
        href="/planning"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Planification
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Heures Planifiées</h1>
          <p className="text-sm text-slate-500">Visites d&apos;entretien, travaux sur devis et dépannages d&apos;un client ou d&apos;un site</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={annee}
            onChange={(e) => aller(client, siteId, Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {resultat && (
            <a
              download
              href={lienExport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
              Export Excel
            </a>
          )}
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <ChoixClientSite
          sites={sites}
          clientNom={client}
          siteId={siteId}
          idClient="heures-client"
          idSite="heures-site"
          obligatoire={false}
          onChange={(choix) => aller(choix.clientNom, choix.siteId, annee)}
        />
        {client && !siteId && <p className="mt-2 text-xs text-slate-500">Tous les sites de {client}. Choisis un site pour n&apos;en voir qu&apos;un.</p>}
      </div>

      {!resultat ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">Choisis un client ou un site.</p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["entretien", "Visites d'entretien"],
                ["devis", "Travaux sur devis"],
                ["depannage", "Dépannages"],
                ["autre", "Autres BI"],
              ] as [TypeLigne, string][]
            ).map(([type, titre]) => (
              <div key={type} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${COULEUR[type]}`}>
                  {titre} ({resultat.totaux[type].nombre})
                </p>
                <p className="text-sm text-slate-600">
                  Prévues : <strong className="text-slate-900">{h(resultat.totaux[type].prevues)}</strong>
                </p>
                <p className="text-sm text-slate-600">
                  Réalisées : <strong className="text-slate-900">{h(resultat.totaux[type].realisees)}</strong>
                </p>
                {type === "entretien" && (
                  <p className="mt-1 text-xs text-slate-400">Heures vendues au contrat : {h(resultat.heuresContrat)} / an</p>
                )}
              </div>
            ))}
          </div>

          <Tableur
            colonnes={COLONNES}
            lignes={resultat.lignes.map((l) => [
              <span key="type" className={`rounded-full px-2 py-0.5 text-xs font-bold ${COULEUR[l.type]}`}>
                {l.libelleType}
              </span>,
              l.debut === l.fin ? jour(l.debut) : `${jour(l.debut)} → ${jour(l.fin)}`,
              l.site,
              l.detail,
              l.techniciens.join(", "),
              h(l.heuresPrevues),
              h(l.heuresRealisees),
              l.biId ? (
                <Link key="etat" href={`/bi/${l.biId}`} className="font-semibold text-brand-green-dark hover:underline">
                  {l.etat}
                </Link>
              ) : (
                <span key="etat" className={l.etat === "Prévu" ? "text-slate-600" : "font-semibold text-amber-700"}>
                  {l.etat}
                </span>
              ),
            ])}
            valeurs={resultat.lignes.map((l) => [l.libelleType, l.debut, l.site, l.detail, l.techniciens.join(", "), "", "", l.etat])}
            vide={`Rien de prévu ni de fait en ${annee}`}
          />
        </>
      )}
    </div>
  );
}

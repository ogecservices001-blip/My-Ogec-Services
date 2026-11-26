import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdminOuAccueil } from "@/lib/auth";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { dateFr } from "@/lib/cerfa/regles";
import { anneesCerfa, chargerDeclarationAnnuelle, chargerParcCerfa, classerParc, type EquipementParc } from "../donnees-parc";
import { EnvoiRecap } from "./envoi-recap";

const COLONNES: ColonneTableur[] = [
  { titre: "Client" },
  { titre: "Site" },
  { titre: "N° équipement", largeur: "130px" },
  { titre: "Équipement" },
  { titre: "Fluide", largeur: "90px" },
  { titre: "Charge", largeur: "80px" },
  { titre: "Dernier contrôle", largeur: "120px" },
  { titre: "Prochain contrôle", largeur: "130px" },
];

const COLONNES_DECLARATION: ColonneTableur[] = [
  { titre: "Fluide" },
  { titre: "CERFA", largeur: "80px", droite: true },
  { titre: "Chargé — équipements neufs (kg)", droite: true },
  { titre: "Chargé — maintenance (kg)", droite: true },
  { titre: "Récupéré — maintenance (kg)", droite: true },
  { titre: "Récupéré — hors d'usage (kg)", droite: true },
];

const kg = (n: number) => (n ? n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "");

function tableau(liste: EquipementParc[]) {
  return (
    <Tableur
      colonnes={COLONNES}
      lignes={liste.map((e) => [
        e.client,
        e.site,
        e.numero,
        <Link key="eq" href={`/cerfa/nouveau?equipementId=${e.id}`} className="font-semibold text-indigo-700 hover:underline">
          {e.nom}
        </Link>,
        e.fluide,
        e.charge,
        e.dernierControle,
        e.prochainControle || "Jamais contrôlé",
      ])}
      valeurs={liste.map((e) => [e.client, e.site, e.numero, e.nom, e.fluide, e.charge, e.dernierControle, e.prochainControle || "Jamais contrôlé"])}
    />
  );
}

/// Point sur les CERFA (AdminCerfaStatusScreen) : équipements soumis
/// (charge > 2 kg) à jour, en retard ou jamais contrôlés, à faire dans le
/// mois ; ceux dont la charge reste à relever ; déclaration annuelle des
/// quantités de fluide.
export default async function PointCerfaPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  await requireAdminOuAccueil();
  const maintenant = new Date();
  const anneeDemandee = Number((await searchParams).annee);
  const annee = Number.isInteger(anneeDemandee) && anneeDemandee > 2000 ? anneeDemandee : maintenant.getFullYear();
  const [parc, declaration, annees] = await Promise.all([chargerParcCerfa(), chargerDeclarationAnnuelle(annee), anneesCerfa()]);
  const { soumis, aJour, enRetard, dansLeMois, chargeARelever } = classerParc(parc, maintenant);

  const ligne = (e: EquipementParc, date: string) => `${e.client} / ${e.site} / ${e.nom} — ${date}`;
  const corps = [
    "Point sur les CERFA — OGEC Services",
    "",
    `À jour : ${aJour.length}`,
    `En retard / à faire : ${enRetard.length}`,
    `À faire dans le mois à venir : ${dansLeMois.length}`,
    `Charge à relever : ${chargeARelever.length}`,
    "",
    ...(enRetard.length ? ["--- En retard / à faire ---", ...enRetard.map((e) => ligne(e, e.prochainControle || "jamais contrôlé")), ""] : []),
    ...(dansLeMois.length ? ["--- Dans le mois à venir ---", ...dansLeMois.map((e) => ligne(e, e.prochainControle))] : []),
  ].join("\n");

  const compteurs: [string, number, string][] = [
    ["À jour", aJour.length, "border-green-200 bg-green-50 text-green-700"],
    ["En retard / à faire", enRetard.length, "border-red-200 bg-red-50 text-red-600"],
    ["Dans le mois", dansLeMois.length, "border-orange-200 bg-orange-50 text-orange-600"],
    ["Charge à relever", chargeARelever.length, "border-slate-200 bg-slate-50 text-slate-600"],
  ];
  const total = declaration.reduce(
    (t, l) => ({
      nbCerfa: t.nbCerfa + l.nbCerfa,
      chargeesNeufs: t.chargeesNeufs + l.chargeesNeufs,
      chargeesMaintenance: t.chargeesMaintenance + l.chargeesMaintenance,
      recupMaintenance: t.recupMaintenance + l.recupMaintenance,
      recupHorsUsage: t.recupHorsUsage + l.recupHorsUsage,
    }),
    { nbCerfa: 0, chargeesNeufs: 0, chargeesMaintenance: 0, recupMaintenance: 0, recupHorsUsage: 0 },
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Point sur les CERFA</h1>
          <p className="text-sm text-slate-500">
            {soumis.length} équipement(s) soumis (charge &gt; 2 kg) — {parc.length} équipement(s) à fluide
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/cerfa/point/export?annee=${annee}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            title="Exporter le point en Excel"
          >
            <Download className="h-4 w-4" /> Export Excel
          </a>
          <EnvoiRecap objet={`Point sur les CERFA — ${dateFr(maintenant)}`} corps={corps} />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {compteurs.map(([titre, n, classes]) => (
          <div key={titre} className={`rounded-2xl border p-4 text-center ${classes}`}>
            <p className="text-3xl font-bold">{n}</p>
            <p className="text-xs font-semibold">{titre}</p>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">Déclaration annuelle des quantités de fluide — {annee}</h2>
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
            {annees.map((a) => (
              <Link
                key={a}
                href={`/cerfa/point?annee=${a}`}
                className={`rounded-lg px-3 py-1 text-sm font-semibold ${a === annee ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                {a}
              </Link>
            ))}
          </div>
        </div>
        <Tableur
          colonnes={COLONNES_DECLARATION}
          lignes={declaration.map((l) => [l.fluide, l.nbCerfa, kg(l.chargeesNeufs), kg(l.chargeesMaintenance), kg(l.recupMaintenance), kg(l.recupHorsUsage)])}
          pied={["Total", total.nbCerfa, kg(total.chargeesNeufs), kg(total.chargeesMaintenance), kg(total.recupMaintenance), kg(total.recupHorsUsage)]}
          vide={`Aucun CERFA en ${annee}`}
          largeurMin={600}
        />
        <p className="mt-1 text-xs text-slate-500">
          Les CERFA repris de l&apos;ancienne appli n&apos;ont pas de quantités : seuls ceux faits dans l&apos;appli alimentent ces totaux.
        </p>
      </section>

      {[
        ["En retard / à faire", enRetard],
        ["Dans le mois à venir", dansLeMois],
        ["À jour", aJour],
        ["Charge à relever", chargeARelever],
      ].map(([titre, liste]) =>
        (liste as EquipementParc[]).length === 0 ? null : (
          <section key={titre as string} className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-indigo-700">
              {titre as string} ({(liste as EquipementParc[]).length})
            </h2>
            {tableau(liste as EquipementParc[])}
          </section>
        ),
      )}
    </div>
  );
}

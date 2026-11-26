import Link from "next/link";
import { requireAdminOuAccueil } from "@/lib/auth";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { dateFr } from "@/lib/cerfa/regles";
import { chargerParcCerfa, type EquipementParc } from "../donnees-parc";
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
/// mois ; plus ceux dont la charge reste à relever.
export default async function PointCerfaPage() {
  await requireAdminOuAccueil();
  const parc = await chargerParcCerfa();
  const maintenant = new Date();
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const dansUnMois = new Date(aujourdhui.getTime() + 30 * 86400000);
  const parDate = (a: EquipementParc, b: EquipementParc) => (a.prochainDate?.getTime() ?? 0) - (b.prochainDate?.getTime() ?? 0);

  const soumis = parc.filter((e) => e.statut === "soumis");
  const enRetard = soumis.filter((e) => !e.prochainDate || e.prochainDate < aujourdhui).sort(parDate);
  const aJour = soumis.filter((e) => e.prochainDate && e.prochainDate >= aujourdhui);
  const dansLeMois = aJour.filter((e) => e.prochainDate! <= dansUnMois).sort(parDate);
  const chargeARelever = parc.filter((e) => e.statut === "charge_inconnue");

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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Point sur les CERFA</h1>
          <p className="text-sm text-slate-500">
            {soumis.length} équipement(s) soumis (charge &gt; 2 kg) — {parc.length} équipement(s) à fluide
          </p>
        </div>
        <EnvoiRecap objet={`Point sur les CERFA — ${dateFr(maintenant)}`} corps={corps} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {compteurs.map(([titre, n, classes]) => (
          <div key={titre} className={`rounded-2xl border p-4 text-center ${classes}`}>
            <p className="text-3xl font-bold">{n}</p>
            <p className="text-xs font-semibold">{titre}</p>
          </div>
        ))}
      </div>
      {[
        ["En retard / à faire", enRetard],
        ["Dans le mois à venir", dansLeMois],
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

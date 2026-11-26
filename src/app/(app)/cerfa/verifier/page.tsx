import Link from "next/link";
import { requireAdminOuAccueil } from "@/lib/auth";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { chargerParcCerfa } from "../donnees-parc";
import { chargerSitesConsultation } from "../sites";

const COLONNES: ColonneTableur[] = [
  { titre: "Client" },
  { titre: "Site" },
  { titre: "N° affaire", largeur: "110px" },
  { titre: "Équipements à fluide", largeur: "110px", droite: true },
  { titre: "Problèmes" },
];

/// Remplace la vérification des dossiers Drive de l'ancienne appli : pour
/// chaque site ayant des équipements à fluide, ce qui empêcherait de faire
/// ou d'envoyer un CERFA (signataire, qualité, email, fluide, charge).
export default async function VerifierDossiersCerfaPage() {
  await requireAdminOuAccueil();
  const [parc, sites] = await Promise.all([chargerParcCerfa(), chargerSitesConsultation()]);
  const parSite = new Map<string, typeof parc>();
  for (const e of parc) {
    if (e.statut === "non_soumis") continue;
    parSite.set(e.siteId, [...(parSite.get(e.siteId) ?? []), e]);
  }

  const lignes = sites
    .filter((s) => parSite.has(s.id))
    .map((s) => {
      const eqs = parSite.get(s.id)!;
      const problemes: string[] = [];
      if (s.signataires.length === 0) problemes.push("Aucun signataire (interlocuteur) sur le site");
      else {
        if (!s.signataires.some((x) => x.email.trim())) problemes.push("Email du signataire manquant");
        if (!s.signataires.some((x) => x.qualite.trim())) problemes.push("Qualité du signataire manquante");
      }
      const sansFluide = eqs.filter((e) => !e.fluide.trim()).map((e) => e.nom);
      const sansCharge = eqs.filter((e) => e.statut === "charge_inconnue").map((e) => e.nom);
      if (sansFluide.length) problemes.push(`Fluide manquant : ${sansFluide.join(", ")}`);
      if (sansCharge.length) problemes.push(`Charge à relever : ${sansCharge.join(", ")}`);
      return { s, nb: eqs.length, problemes };
    })
    .filter((l) => l.problemes.length > 0);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Vérifier les dossiers clients</h1>
      <p className="mb-4 text-sm text-slate-500">
        {lignes.length} site(s) à compléter sur {parSite.size} site(s) avec des équipements soumis ou à charge inconnue
      </p>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map(({ s, nb, problemes }) => [
          s.nom,
          <Link key="site" href={`/repertoire/clients/${s.id}`} className="font-semibold text-indigo-700 hover:underline">
            {s.site || "Site sans nom"}
          </Link>,
          s.n_affaire,
          nb,
          <ul key="pb" className="list-disc space-y-0.5 pl-4">
            {problemes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>,
        ])}
        valeurs={lignes.map(({ s, nb, problemes }) => [s.nom, s.site, s.n_affaire, nb, problemes.join(" | ")])}
        vide="Tous les dossiers sont complets"
      />
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import { Statuts, labelPole, sansTempsPasse } from "@/lib/bi/constants";
import { montantMainDoeuvre, montantDeplacements, totalHT, eur, type Presta, type TauxSite } from "@/lib/bi/format";
import { formaterDate } from "@/lib/format";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Classement" },
  { titre: "Site" },
  { titre: "Date intervention" },
  { titre: "Pôle" },
  { titre: "Équipement" },
  { titre: "Techniciens" },
  { titre: "Temps passé" },
  { titre: "Numéro" },
  { titre: "Montant", droite: true, largeur: "110px" },
];

const LABEL_CLASSEMENT: Record<string, string> = {
  facturer: "À facturer",
  reception_travaux: "Réception travaux",
  maintenance: "Maintenance",
};

const STATUTS_VALIDES_BI = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

export default async function BonInterventionGroupeClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ nom: string }>;
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const { data: sitesData } = await supabase
    .from("sites_view")
    .select("id, site, taux_horaire_regie, forfait_deplacement")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat);
  const sites = (sitesData ?? []) as (Pick<Site, "id" | "site"> & { taux_horaire_regie: string; forfait_deplacement: string })[];
  const siteIds = sites.map((s) => s.id);
  const siteParId = new Map(sites.map((s) => [s.id, s]));

  const { data: bonsData } =
    siteIds.length > 0
      ? await supabase
          .from("bons_intervention")
          .select(
            "id, numero, pole, classement, equipement_nom, techniciens, temps_passe, date_intervention, devis_id, nombre_deplacements, prestas, interventions_supplementaires, site_id",
          )
          .in("site_id", siteIds)
          .in("statut", STATUTS_VALIDES_BI)
          .order("date_intervention", { ascending: false })
      : { data: [] };
  const lignes = bonsData ?? [];

  const devisIds = [...new Set(lignes.filter((b) => sansTempsPasse(b.pole) && b.devis_id).map((b) => b.devis_id as string))];
  const { data: devisLies } = devisIds.length > 0 ? await supabase.from("devis").select("id, montant").in("id", devisIds) : { data: [] };
  const montantDevisParId = new Map((devisLies ?? []).map((d) => [d.id, d.montant ?? 0]));

  function montant(b: (typeof lignes)[number]): number {
    const taux: TauxSite = b.site_id ? (siteParId.get(b.site_id) ?? null) : null;
    const forfait = sansTempsPasse(b.pole);
    const montantHeures = forfait ? 0 : (montantMainDoeuvre(b.temps_passe, taux) ?? 0);
    const montantDepl = forfait ? 0 : (montantDeplacements(b.nombre_deplacements, taux) ?? 0);
    const prestas = [
      ...(b.prestas as unknown as Presta[]),
      ...(b.interventions_supplementaires as unknown as { prestas: Presta[] }[]).flatMap((i) => i.prestas ?? []),
    ];
    const montantDevis = forfait && b.devis_id ? (montantDevisParId.get(b.devis_id) ?? 0) : 0;
    return montantDevis + montantHeures + montantDepl + totalHT(prestas);
  }

  return (
    <div>
      <FilAjouter maillons={[{ nom: nomDecode, href: `/repertoire/clients/groupe/${nom}?horsContrat=${horsContrat ? 1 : 0}` }, { nom: "Bon d'intervention" }]} />
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Bon d&apos;intervention</h1>
        <p className="text-sm text-slate-500">{nomDecode} — {lignes.length} bon(s)</p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map((b) => [
          LABEL_CLASSEMENT[b.classement ?? ""] ?? "À classer",
          b.site_id ? (siteParId.get(b.site_id)?.site ?? "") : "",
          formaterDate(b.date_intervention),
          labelPole(b.pole),
          b.equipement_nom,
          (b.techniciens as string[] | null)?.join(", ") ?? "",
          b.temps_passe,
          <Link key="numero" href={`/bi/${b.id}`} className="font-bold text-slate-900 hover:underline">
            {b.numero || "BI (brouillon)"}
          </Link>,
          eur(montant(b)),
        ])}
        valeurs={lignes.map((b) => [
          LABEL_CLASSEMENT[b.classement ?? ""] ?? "À classer",
          b.site_id ? (siteParId.get(b.site_id)?.site ?? "") : "",
          formaterDate(b.date_intervention),
          labelPole(b.pole),
          b.equipement_nom,
          (b.techniciens as string[] | null)?.join(", ") ?? "",
          b.numero,
        ])}
        vide="Aucun bon d'intervention pour ce client"
      />
    </div>
  );
}

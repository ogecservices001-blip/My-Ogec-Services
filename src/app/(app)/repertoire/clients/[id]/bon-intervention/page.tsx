import { notFound } from "next/navigation";
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

export default async function BonInterventionClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: site }, { data: bons }] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat, taux_horaire_regie, forfait_deplacement").eq("id", id).single(),
    supabase
      .from("bons_intervention")
      .select(
        "id, numero, pole, classement, equipement_nom, techniciens, temps_passe, date_intervention, devis_id, nombre_deplacements, prestas, interventions_supplementaires",
      )
      .eq("site_id", id)
      .in("statut", STATUTS_VALIDES_BI)
      .order("date_intervention", { ascending: false }),
  ]);
  if (!site) notFound();
  const s = site as Site;
  const taux: TauxSite = { taux_horaire_regie: s.taux_horaire_regie, forfait_deplacement: s.forfait_deplacement };

  const lignes = bons ?? [];
  const devisIds = [...new Set(lignes.filter((b) => sansTempsPasse(b.pole) && b.devis_id).map((b) => b.devis_id as string))];
  const { data: devisLies } = devisIds.length > 0 ? await supabase.from("devis").select("id, montant").in("id", devisIds) : { data: [] };
  const montantDevisParId = new Map((devisLies ?? []).map((d) => [d.id, d.montant ?? 0]));

  function montant(b: (typeof lignes)[number]): number {
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
      <FilAjouter
        maillons={[
          { nom: s.nom, href: `/repertoire/clients/groupe/${encodeURIComponent(s.nom)}?horsContrat=${s.hors_contrat ? 1 : 0}` },
          { nom: s.site || "Site sans nom", href: `/repertoire/clients/${id}` },
          { nom: "Bon d'intervention" },
        ]}
      />
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Bon d&apos;intervention</h1>
        <p className="text-sm text-slate-500">{[s.nom, s.site].filter(Boolean).join(" — ")} — {lignes.length} bon(s)</p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map((b) => [
          LABEL_CLASSEMENT[b.classement ?? ""] ?? "À classer",
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
          formaterDate(b.date_intervention),
          labelPole(b.pole),
          b.equipement_nom,
          (b.techniciens as string[] | null)?.join(", ") ?? "",
          b.numero,
        ])}
        vide="Aucun bon d'intervention pour ce site"
      />
    </div>
  );
}

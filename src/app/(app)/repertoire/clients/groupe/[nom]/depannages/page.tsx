import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import { formaterDate } from "@/lib/format";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Statut" },
  { titre: "Site" },
  { titre: "Date" },
  { titre: "Équipement" },
  { titre: "Motif" },
  { titre: "Lieu de la panne" },
  { titre: "Intervenant" },
  { titre: "N° demande" },
  { titre: "Date traitement" },
];

export default async function DepannagesGroupeClientPage({
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
    .select("id, site")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat);
  const sites = (sitesData ?? []) as Pick<Site, "id" | "site">[];
  const siteIds = sites.map((s) => s.id);
  const siteParId = new Map(sites.map((s) => [s.id, s.site]));

  const { data: demandes } =
    siteIds.length > 0
      ? await supabase
          .from("demandes_depannage")
          .select("id, numero, statut, date_creation, date_traitement, equipement_nom, message, lieu_panne, intervenant_id, site_id")
          .in("site_id", siteIds)
          .order("date_creation", { ascending: false })
      : { data: [] };

  const intervenantIds = [...new Set((demandes ?? []).map((d) => d.intervenant_id).filter((v): v is string => Boolean(v)))];
  const { data: intervenants } =
    intervenantIds.length > 0 ? await supabase.from("profiles").select("id, name").in("id", intervenantIds) : { data: [] };
  const nomParIntervenant = new Map((intervenants ?? []).map((p) => [p.id, p.name]));

  const lignes = demandes ?? [];

  return (
    <div>
      <FilAjouter maillons={[{ nom: nomDecode, href: `/repertoire/clients/groupe/${nom}?horsContrat=${horsContrat ? 1 : 0}` }, { nom: "Dépannages" }]} />
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Dépannages</h1>
        <p className="text-sm text-slate-500">{nomDecode} — {lignes.length} dépannage(s)</p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map((d) => [
          d.statut === "traitee" ? "Traité" : "En cours",
          d.site_id ? (siteParId.get(d.site_id) ?? "") : "",
          formaterDate(d.date_creation),
          d.equipement_nom,
          d.message,
          d.lieu_panne,
          d.intervenant_id ? (nomParIntervenant.get(d.intervenant_id) ?? "") : "",
          <Link key="numero" href={`/depannages/${d.id}`} className="font-bold text-slate-900 hover:underline">
            {d.numero || "(sans numéro)"}
          </Link>,
          d.date_traitement ? formaterDate(d.date_traitement) : "",
        ])}
        valeurs={lignes.map((d) => [
          d.statut === "traitee" ? "Traité" : "En cours",
          d.site_id ? (siteParId.get(d.site_id) ?? "") : "",
          formaterDate(d.date_creation),
          d.equipement_nom,
          d.message,
          d.lieu_panne,
          d.intervenant_id ? (nomParIntervenant.get(d.intervenant_id) ?? "") : "",
          d.numero,
        ])}
        vide="Aucun dépannage pour ce client"
      />
    </div>
  );
}

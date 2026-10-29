import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import { formaterDate } from "@/lib/format";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Statut" },
  { titre: "Date" },
  { titre: "Équipement" },
  { titre: "Motif" },
  { titre: "Lieu de la panne" },
  { titre: "Intervenant" },
  { titre: "N° demande" },
  { titre: "Date traitement" },
];

export default async function DepannagesClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: site }, { data: demandes }] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").eq("id", id).single(),
    supabase
      .from("demandes_depannage")
      .select("id, numero, statut, date_creation, date_traitement, equipement_nom, message, lieu_panne, intervenant_id")
      .eq("site_id", id)
      .order("date_creation", { ascending: false }),
  ]);
  if (!site) notFound();
  const s = site as Site;

  const intervenantIds = [...new Set((demandes ?? []).map((d) => d.intervenant_id).filter((v): v is string => Boolean(v)))];
  const { data: intervenants } =
    intervenantIds.length > 0 ? await supabase.from("profiles").select("id, name").in("id", intervenantIds) : { data: [] };
  const nomParIntervenant = new Map((intervenants ?? []).map((p) => [p.id, p.name]));

  const lignes = demandes ?? [];

  return (
    <div>
      <FilAjouter
        maillons={[
          { nom: s.nom, href: `/repertoire/clients/groupe/${encodeURIComponent(s.nom)}?horsContrat=${s.hors_contrat ? 1 : 0}` },
          { nom: s.site || "Site sans nom", href: `/repertoire/clients/${id}` },
          { nom: "Dépannages" },
        ]}
      />
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Dépannages</h1>
        <p className="text-sm text-slate-500">{[s.nom, s.site].filter(Boolean).join(" — ")} — {lignes.length} dépannage(s)</p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map((d) => [
          d.statut === "traitee" ? "Traité" : "En cours",
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
          formaterDate(d.date_creation),
          d.equipement_nom,
          d.message,
          d.lieu_panne,
          d.intervenant_id ? (nomParIntervenant.get(d.intervenant_id) ?? "") : "",
          d.numero,
        ])}
        vide="Aucun dépannage pour ce site"
      />
    </div>
  );
}

import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerCreneauxSemaine, chargerTechniciens, chargerPostesHorsClient } from "./actions";
import { GrilleSemaine } from "./grille-semaine";
import { ajouterJours, lundiDeLaSemaine } from "@/lib/planning/dates";

export default async function PlanificationPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  await requireAdmin();
  const { semaine } = await searchParams;
  const lundi = lundiDeLaSemaine(semaine);
  const vendredi = ajouterJours(lundi, 4);

  const supabase = await createClient();
  const [{ data: sites }, techniciens, postesHorsClient, creneaux, { data: joursFeries }] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site").order("nom"),
    chargerTechniciens(),
    chargerPostesHorsClient(),
    chargerCreneauxSemaine(lundi, vendredi),
    supabase.from("jours_feries").select("date").gte("date", lundi).lte("date", vendredi),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Planification</h1>
          <p className="text-sm text-slate-500">Pose les créneaux de la semaine pour chaque technicien</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/planning/export"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            title="Exporter en Excel"
          >
            <Download className="h-4 w-4" strokeWidth={2.25} />
          </a>
          <Link
            href="/planning/importer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            title="Importer depuis Excel"
          >
            <Upload className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
      <GrilleSemaine
        lundiSemaine={lundi}
        sites={sites ?? []}
        techniciens={techniciens}
        postesHorsClient={postesHorsClient}
        joursFeries={(joursFeries ?? []).map((j) => j.date)}
        creneaux={creneaux}
      />
    </div>
  );
}

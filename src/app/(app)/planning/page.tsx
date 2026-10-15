import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerCreneauxSemaine, chargerTechniciens } from "./actions";
import { GrilleSemaine } from "./grille-semaine";

/// Lundi de la semaine ISO contenant `date` (ou aujourd'hui).
function lundiDeLaSemaine(dateISO?: string): string {
  const d = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
  const jour = d.getDay(); // 0 = dimanche
  const decalage = jour === 0 ? -6 : 1 - jour;
  d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
}

function ajouterJours(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

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
  const [{ data: sites }, techniciens, creneaux, { data: joursFeries }] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site").order("nom"),
    chargerTechniciens(),
    chargerCreneauxSemaine(lundi, vendredi),
    supabase.from("jours_feries").select("date").gte("date", lundi).lte("date", vendredi),
  ]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Planification</h1>
        <p className="text-sm text-slate-500">Pose les créneaux de la semaine pour chaque technicien</p>
      </div>
      <GrilleSemaine
        lundiSemaine={lundi}
        sites={sites ?? []}
        techniciens={techniciens}
        joursFeries={(joursFeries ?? []).map((j) => j.date)}
        creneaux={creneaux}
      />
    </div>
  );
}

import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerCreneauxSemaine, chargerMesCreneaux, chargerTechniciens } from "../actions";
import { MaSemaine } from "./ma-semaine";
import { GrilleSemaine } from "../grille-semaine";
import { ajouterJours, lundiDeLaSemaine } from "@/lib/planning/dates";

export default async function MonPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; semaine?: string }>;
}) {
  const profile = await requireProfile();
  const { vue, semaine } = await searchParams;
  const general = vue === "general" && (profile.role === "technicien" || profile.role === "admin");
  const lundi = lundiDeLaSemaine(semaine);
  const vendredi = ajouterJours(lundi, 4);

  const supabase = await createClient();
  const { data: feries } = await supabase.from("jours_feries").select("date").gte("date", lundi).lte("date", vendredi);
  const joursFeries = (feries ?? []).map((j) => j.date);

  const onglet = (actif: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${actif ? "bg-brand-green text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`;

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Mon planning</h1>
      </div>
      <div className="mb-4 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        <Link href={`/planning/mon-planning?vue=semaine&semaine=${lundi}`} className={onglet(!general)}>
          Ma semaine
        </Link>
        <Link href={`/planning/mon-planning?vue=general&semaine=${lundi}`} className={onglet(general)}>
          Planning général
        </Link>
      </div>

      {general ? (
        <GrilleSemaine
          key={lundi}
          lundiSemaine={lundi}
          sites={[]}
          techniciens={await chargerTechniciens()}
          postesHorsClient={[]}
          devisARealiser={[]}
          joursFeries={joursFeries}
          creneaux={await chargerCreneauxSemaine(lundi, vendredi)}
          lectureSeule
          prefixeLien="/planning/mon-planning?vue=general&semaine="
        />
      ) : (
        <MaSemaine key={lundi} lundiSemaine={lundi} creneaux={await chargerMesCreneaux(lundi, vendredi)} joursFeries={joursFeries} />
      )}
    </div>
  );
}

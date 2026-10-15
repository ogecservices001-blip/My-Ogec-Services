import { requireAdmin } from "@/lib/auth";
import { chargerPointagesDuMois } from "./actions";
import { PointagesListe } from "./pointages-liste";

function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function RessourcesHumainesPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  await requireAdmin();
  const { mois: moisParam } = await searchParams;
  const mois = moisParam ?? moisCourant();

  const pointages = await chargerPointagesDuMois(mois);

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Ressources Humaines</h1>
        <p className="text-sm text-slate-500">Pointage des heures — importé depuis le Planning, indépendant une fois importé</p>
      </div>
      <PointagesListe mois={mois} pointages={pointages} />
    </div>
  );
}

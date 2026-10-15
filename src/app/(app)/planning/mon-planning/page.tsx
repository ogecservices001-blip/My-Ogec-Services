import { requireProfile } from "@/lib/auth";
import { chargerMesCreneaux } from "../actions";
import { MonPlanningListe } from "./mon-planning-liste";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function ajouterJours(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function MonPlanningPage() {
  await requireProfile();
  const debut = aujourdhui();
  // Fenêtre large (3 semaines à partir d'aujourd'hui) pour que le
  // technicien voie venir ses prochains jours sans naviguer — les jours
  // déjà passés de la semaine en cours ne l'intéressent plus.
  const fin = ajouterJours(debut, 21);

  const creneaux = await chargerMesCreneaux(debut, fin);

  const parJour = new Map<string, typeof creneaux>();
  for (const c of creneaux) {
    const liste = parJour.get(c.date) ?? [];
    liste.push(c);
    parJour.set(c.date, liste);
  }
  const jours = [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Mon planning</h1>
        <p className="text-sm text-slate-500">Tes créneaux des 3 prochaines semaines</p>
      </div>
      <MonPlanningListe jours={jours} />
    </div>
  );
}

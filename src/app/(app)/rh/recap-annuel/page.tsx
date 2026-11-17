import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerLignesAnnee } from "@/lib/rh/lignes";
import { chargerContexteRecap, recapParSalarie } from "@/lib/rh/annuel";
import { RecapVue } from "./vue";

export default async function RecapAnnuelPage({ searchParams }: { searchParams: Promise<{ annee?: string; mois?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const anneeCourante = Number(aujourdhui.slice(0, 4));
  const annee = /^\d{4}$/.test(params.annee ?? "") ? Number(params.annee) : anneeCourante;
  const moisDefaut = annee === anneeCourante ? Number(aujourdhui.slice(5, 7)) : 12;
  const mois = Number(params.mois) >= 1 && Number(params.mois) <= 12 ? Number(params.mois) : moisDefaut;
  const supabase = await createClient();
  const [lignes, contexte] = await Promise.all([chargerLignesAnnee(supabase, annee, aujourdhui), chargerContexteRecap(supabase)]);
  const annuel = recapParSalarie(lignes, contexte);
  const mensuel = recapParSalarie(
    lignes.filter((l) => Number(l.date.slice(5, 7)) === mois),
    contexte,
  );
  return <RecapVue key={`${annee}-${mois}`} annee={annee} mois={mois} anneeCourante={anneeCourante} annuel={annuel} mensuel={mensuel} aujourdhui={aujourdhui} />;
}

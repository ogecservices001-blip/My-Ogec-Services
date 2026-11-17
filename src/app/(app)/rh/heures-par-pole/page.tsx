import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerLignesAnnee } from "@/lib/rh/lignes";
import { heuresParPole } from "@/lib/rh/annuel";
import { HeuresParPoleVue } from "./vue";

export default async function HeuresParPolePage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const anneeCourante = Number(aujourdhui.slice(0, 4));
  const annee = /^\d{4}$/.test(params.annee ?? "") ? Number(params.annee) : anneeCourante;
  const supabase = await createClient();
  const donnees = heuresParPole(await chargerLignesAnnee(supabase, annee, aujourdhui));
  return <HeuresParPoleVue key={annee} annee={annee} anneeCourante={anneeCourante} donnees={donnees} aujourdhui={aujourdhui} />;
}

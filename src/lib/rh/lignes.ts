import type { SupabaseClient } from "@supabase/supabase-js";
import { calculerPointage, type LignePointage } from "./pointage";
import { finDuMois } from "./mois";

export type ClotureMois = { le: string; par: string; dateArrete: string };

/// Lignes de pointage d'un mois : figées jusqu'à la date d'arrêté s'il est
/// clôturé, recalculées pour les jours suivants (régularisations).
export async function chargerLignesPointage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mois: string,
): Promise<{ lignes: LignePointage[]; cloture: ClotureMois | null }> {
  const { data: cloture } = await supabase.from("rh_clotures").select("cloture_le, cloture_par, date_arrete, lignes").eq("mois", mois).maybeSingle();
  if (!cloture) return { lignes: (await calculerPointage(supabase, mois)).lignes, cloture: null };
  const dateArrete = cloture.date_arrete ?? finDuMois(mois);
  const figees = ((cloture.lignes as LignePointage[]) ?? []).filter((l) => l.date <= dateArrete);
  const suivantes = dateArrete < finDuMois(mois) ? (await calculerPointage(supabase, mois)).lignes.filter((l) => l.date > dateArrete) : [];
  return {
    lignes: [...figees, ...suivantes].sort((a, b) => a.salarie.localeCompare(b.salarie, "fr") || a.date.localeCompare(b.date)),
    cloture: { le: cloture.cloture_le, par: cloture.cloture_par, dateArrete },
  };
}

/// Toutes les lignes de l'année jusqu'à aujourd'hui (les créneaux à venir ne
/// sont que prévus).
export async function chargerLignesAnnee(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  annee: number,
  aujourdhui: string,
): Promise<LignePointage[]> {
  const mois = Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, "0")}`).filter((m) => `${m}-01` <= aujourdhui);
  const parMois = await Promise.all(mois.map((m) => chargerLignesPointage(supabase, m)));
  return parMois.flatMap((r) => r.lignes).filter((l) => l.date <= aujourdhui);
}

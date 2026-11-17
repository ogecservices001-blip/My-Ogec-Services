import type { createClient } from "@/lib/supabase/server";
import { tauxHoraireDepuisArticles } from "@/lib/devis/referentiel-pu";
import type { CoutRevient } from "@/lib/devis/pricing";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function tauxHoraireReferentiel(supabase: Client): Promise<{ taux: number; trouve: boolean }> {
  const { data } = await supabase.from("referentiel_pu").select("famille, type, tarif_net_ht").ilike("famille", "main d%");
  return tauxHoraireDepuisArticles(data ?? []);
}

function tauxEnregistre(cout: unknown): string | null {
  const v = (cout as Partial<CoutRevient> | null)?.r2TauxHoraire;
  return v && String(v).trim() ? String(v) : null;
}

/// Taux horaire jamais saisi : celui déjà figé dans le devis (révision,
/// devis en cours repris), sinon celui du référentiel au moment de la création.
export async function coutAvecTauxHoraire(
  supabase: Client,
  cout: CoutRevient,
  coutEnregistre: unknown,
): Promise<CoutRevient> {
  const fige = tauxEnregistre(coutEnregistre);
  if (fige) return { ...cout, r2TauxHoraire: fige };
  const { taux } = await tauxHoraireReferentiel(supabase);
  return { ...cout, r2TauxHoraire: String(taux) };
}

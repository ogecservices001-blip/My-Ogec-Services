import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerEtatPreparatoire } from "@/lib/rh/etat";
import { EtatVue } from "./vue";

export default async function EtatPreparatoirePage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin();
  const { mois: brut } = await searchParams;
  const mois = brut && /^\d{4}-(0[1-9]|1[0-2])$/.test(brut) ? brut : new Date().toISOString().slice(0, 7);
  const supabase = await createClient();
  const etat = await chargerEtatPreparatoire(supabase, mois);
  return <EtatVue key={mois} etat={etat} />;
}

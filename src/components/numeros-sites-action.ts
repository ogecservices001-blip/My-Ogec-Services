"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type NumeroSite = { id: string; nom: string; site: string; n_affaire: string };

/// N° d'affaire de tous les sites — pour la recherche par n° dans le choix
/// Client | Site des listes qui ne connaissent que les noms.
export async function chargerNumerosSites(): Promise<NumeroSite[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("sites_view").select("id, nom, site, n_affaire");
  return (data ?? []) as NumeroSite[];
}

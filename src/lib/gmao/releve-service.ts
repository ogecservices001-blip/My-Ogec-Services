import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/// Avant cette date, aucune visite n'est comptée (base de test à vider
/// avant la vraie mise en production). Port de `coupureComptageVisites`
/// (releve_service.dart).
export const COUPURE_COMPTAGE_VISITES = new Date(Date.UTC(2026, 0, 1));

/// Visite en cours d'un équipement pour l'année de contrat en cours : plus
/// haut n° de visite validé pour cette année + 1. Une visite = un BI
/// "Entretien sous contrat" validé, dont le bureau a saisi le n° et l'année
/// (table visites_entretien) ; les relevés GMAO ne comptent pas. Le
/// compteur repart à 1 chaque année, que toutes les visites de l'année
/// précédente aient été faites ou non. `null` avant
/// `COUPURE_COMPTAGE_VISITES`.
export async function freqCouranteCalculee(
  supabase: SupabaseServerClient,
  equipementId: string,
): Promise<number | null> {
  return (await freqCouranteCalculeeBatch(supabase, [equipementId])).get(equipementId) ?? null;
}

/// Même calcul pour plusieurs équipements en un seul aller-retour : la
/// table des visites d'une année reste petite, elle est lue en entier puis
/// filtrée localement (un `.in()` sur tout le parc serait trop long).
export async function freqCouranteCalculeeBatch(
  supabase: SupabaseServerClient,
  equipementIds: string[],
): Promise<Map<string, number | null>> {
  const resultat = new Map<string, number | null>();
  if (equipementIds.length === 0) return resultat;

  const maintenant = new Date();
  if (maintenant < COUPURE_COMPTAGE_VISITES) {
    for (const id of equipementIds) resultat.set(id, null);
    return resultat;
  }

  const { data } = await supabase
    .from("visites_entretien")
    .select("equipement_id, visite_numero")
    .eq("annee", maintenant.getUTCFullYear())
    .returns<{ equipement_id: string; visite_numero: number }[]>();

  const derniere = new Map<string, number>();
  for (const row of data ?? []) {
    derniere.set(row.equipement_id, Math.max(derniere.get(row.equipement_id) ?? 0, row.visite_numero));
  }
  for (const id of equipementIds) resultat.set(id, (derniere.get(id) ?? 0) + 1);
  return resultat;
}

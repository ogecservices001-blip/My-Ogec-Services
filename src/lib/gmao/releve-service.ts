import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/// Avant cette date, aucune visite n'est comptée (base de test à vider
/// avant la vraie mise en production) — évite que des relevés de test
/// faussent le calcul de "Fréquence courante". Port de
/// `coupureComptageVisites` (releve_service.dart).
export const COUPURE_COMPTAGE_VISITES = new Date(Date.UTC(2026, 0, 1));

/// Nombre de relevés déjà enregistrés pour `equipementId` durant
/// l'année civile `annee`.
export async function compterVisitesAnnee(
  supabase: SupabaseServerClient,
  equipementId: string,
  annee: number,
): Promise<number> {
  const debut = new Date(Date.UTC(annee, 0, 1)).toISOString();
  const fin = new Date(Date.UTC(annee + 1, 0, 1)).toISOString();
  const { count } = await supabase
    .from("releves")
    .select("*", { count: "exact", head: true })
    .eq("equipement_id", equipementId)
    .gte("date", debut)
    .lt("date", fin);
  return count ?? 0;
}

/// "Fréquence courante" calculée pour la visite en cours d'un
/// équipement : nombre de relevés déjà faits cette année + 1. `null`
/// avant `COUPURE_COMPTAGE_VISITES`.
export async function freqCouranteCalculee(
  supabase: SupabaseServerClient,
  equipementId: string,
): Promise<number | null> {
  const maintenant = new Date();
  if (maintenant < COUPURE_COMPTAGE_VISITES) return null;
  const visites = await compterVisitesAnnee(supabase, equipementId, maintenant.getUTCFullYear());
  return visites + 1;
}

/// Variante "Fréquence courante" pour plusieurs équipements en un seul
/// aller-retour réseau (au lieu d'un `freqCouranteCalculee` par
/// équipement) — même résultat, utilisée pour les compteurs de liste
/// (parc d'un site, d'un client, ou global). Ne filtre PAS par
/// `equipement_id` côté requête (un `.in()` sur des milliers d'ids —
/// tout le parc GMAO au niveau global — dépasserait vite une taille de
/// requête raisonnable) : la table `releves` d'une année civile reste
/// petite quel que soit le nombre d'équipements, donc on la lit en
/// entier et on filtre localement.
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

  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1)).toISOString();
  const fin = new Date(Date.UTC(maintenant.getUTCFullYear() + 1, 0, 1)).toISOString();
  const { data } = await supabase
    .from("releves")
    .select("equipement_id")
    .gte("date", debut)
    .lt("date", fin)
    .returns<{ equipement_id: string }[]>();

  const comptes = new Map<string, number>();
  for (const row of data ?? []) {
    comptes.set(row.equipement_id, (comptes.get(row.equipement_id) ?? 0) + 1);
  }
  for (const id of equipementIds) resultat.set(id, (comptes.get(id) ?? 0) + 1);
  return resultat;
}

import { createClient } from "@/lib/supabase/server";
import { STATUTS_BI_REALISE } from "@/app/(app)/devis/statut";

/// Libellés des devis "en cours" (commandés, non annulés, non réalisés)
/// par équipement — sans montant, pour l'affichage technicien. Objet
/// plutôt que Map : ce résultat traverse la frontière serveur → client.
export async function chargerDevisEnCoursParEquipement(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data: devis } = await supabase
    .from("devis")
    .select("id, libelle, equipement_id, bi_reference_historique")
    .not("equipement_id", "is", null)
    .neq("date_commande_client", "")
    .eq("annule", false);
  if (!devis || devis.length === 0) return {};

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("devis_id, statut")
    .in("devis_id", devis.map((d) => d.id));
  const dejaRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id),
  );

  const parEquipement: Record<string, string[]> = {};
  for (const d of devis) {
    if (!d.equipement_id || dejaRealises.has(d.id) || d.bi_reference_historique) continue;
    (parEquipement[d.equipement_id] ??= []).push(d.libelle || "Devis sans libellé");
  }
  return parEquipement;
}

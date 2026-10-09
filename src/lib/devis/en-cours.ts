import { createClient } from "@/lib/supabase/server";
import { STATUTS_BI_REALISE, calculerStatutDevis, type StatutDevis } from "@/app/(app)/devis/statut";

export type DevisEnCours = { numero: string; libelle: string; statut: StatutDevis };

/// Devis liés à un équipement, hors ceux déjà réalisés — dès la
/// création, pas besoin d'être commandé, et les annulés restent
/// affichés (étiquetés) plutôt que masqués. Objet plutôt que Map : ce
/// résultat traverse la frontière serveur → client.
export async function chargerDevisEnCoursParEquipement(): Promise<Record<string, DevisEnCours[]>> {
  const supabase = await createClient();
  const { data: devis } = await supabase
    .from("devis")
    .select("id, numero, libelle, equipement_id, annule, date_commande_client, bi_reference_historique, mois_facturation")
    .not("equipement_id", "is", null);
  if (!devis || devis.length === 0) return {};

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("devis_id, statut")
    .in("devis_id", devis.map((d) => d.id));
  const dejaRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id),
  );

  const parEquipement: Record<string, DevisEnCours[]> = {};
  for (const d of devis) {
    // Facturable = déjà finalisé, ne doit plus apparaître comme "en cours".
    if (!d.equipement_id || dejaRealises.has(d.id) || d.bi_reference_historique || d.mois_facturation) continue;
    const statut = calculerStatutDevis({
      annule: d.annule,
      commande: Boolean(d.date_commande_client),
      realise: false,
      facturable: false,
    });
    (parEquipement[d.equipement_id] ??= []).push({
      numero: d.numero,
      libelle: d.libelle || "Devis sans libellé",
      statut,
    });
  }
  return parEquipement;
}

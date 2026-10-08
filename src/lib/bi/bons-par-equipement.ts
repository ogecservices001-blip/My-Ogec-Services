import { createClient } from "@/lib/supabase/server";
import { Poles } from "./constants";
import type { InterventionEquipement } from "./format";

export type BonParEquipement = { numero: string; statut: string; compte_rendu: string; etat_equipement: string[] };

/// Tous les BI concernant un équipement — qu'il soit l'équipement
/// principal du bon (colonne equipement_id) ou ajouté via "Autre
/// équipement" (pôle Dépannage, caché dans interventions_supplementaires,
/// donc une recherche par colonne ne le trouve pas). Tous statuts
/// confondus, pour la fiche équipement GMAO.
export async function chargerBonsInterventionParEquipement(equipementId: string): Promise<BonParEquipement[]> {
  const supabase = await createClient();
  const [{ data: directs }, { data: avecSupplementaires }] = await Promise.all([
    supabase
      .from("bons_intervention")
      .select("numero, statut, compte_rendu, etat_equipement")
      .eq("equipement_id", equipementId),
    supabase
      .from("bons_intervention")
      .select("numero, statut, interventions_supplementaires")
      .eq("pole", Poles.depannage),
  ]);

  const resultats: BonParEquipement[] = (directs ?? []).map((b) => ({
    numero: b.numero,
    statut: b.statut,
    compte_rendu: b.compte_rendu,
    etat_equipement: (b.etat_equipement as string[] | null) ?? [],
  }));

  for (const b of avecSupplementaires ?? []) {
    const interventions = (b.interventions_supplementaires as InterventionEquipement[] | null) ?? [];
    for (const inter of interventions) {
      if (inter.equipement_id === equipementId) {
        resultats.push({
          numero: b.numero,
          statut: b.statut,
          compte_rendu: inter.compte_rendu,
          etat_equipement: inter.etat_equipement ?? [],
        });
      }
    }
  }

  return resultats;
}

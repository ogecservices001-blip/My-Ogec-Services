import type { SupabaseClient } from "@supabase/supabase-js";
import type { Site } from "@/lib/types";
import type { Equipement, ReferenceHoraire } from "@/lib/gmao/types";
import { freqCouranteCalculeeBatch } from "@/lib/gmao/releve-service";
import { sommeHeuresAnnee } from "@/lib/gmao/calcul-heures-visite";
import { extraireNumero } from "@/lib/gmao/equipement-import";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";

export type LigneAuditHeures = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  progTech: number;
  progAssistant: number;
  realTech: number;
  realAssistant: number;
  contratTech: number;
  contratAssistant: number;
  numClient: number;
  numSite: number;
};

function parseHeures(v: string): number {
  const n = parseFloat(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/// Calcule l'audit heures (prévues restantes / réalisées / vendues au
/// contrat) pour tous les sites sous contrat — partagé par la page et
/// l'export, pour ne jamais faire diverger les deux.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculerLignesAuditHeures(supabase: SupabaseClient<any>): Promise<LigneAuditHeures[]> {
  const { data: sitesData } = await supabase.from("sites_view").select("*").eq("hors_contrat", false);
  const sites = (sitesData ?? []) as Site[];
  const siteIds = sites.map((s) => s.id);

  const [equipements, { data: references }] = await Promise.all([
    recupererToutesLesLignes<Equipement>((debut, fin) =>
      supabase.from("equipements").select("*").in("site_id", siteIds).range(debut, fin),
    ),
    supabase.from("references_horaires").select("*"),
  ]);

  const freqCouranteParEquipement = await freqCouranteCalculeeBatch(
    supabase,
    equipements.map((e) => e.id),
  );

  const equipementsParSite = new Map<string, Equipement[]>();
  for (const eq of equipements) {
    const liste = equipementsParSite.get(eq.site_id) ?? [];
    liste.push(eq);
    equipementsParSite.set(eq.site_id, liste);
  }

  return sites
    .map((s) => {
      const heures = sommeHeuresAnnee(
        equipementsParSite.get(s.id) ?? [],
        (references ?? []) as ReferenceHoraire[],
        freqCouranteParEquipement,
      );
      const parts = s.n_affaire.split("-");
      const numClient = extraireNumero(parts[0] ?? "") ?? Number.MAX_SAFE_INTEGER;
      const numSite = extraireNumero(parts.slice(1).join("-") ?? "") ?? Number.MAX_SAFE_INTEGER;
      return {
        id: s.id,
        numero: s.n_affaire,
        clientNom: s.nom,
        clientSite: s.site,
        progTech: heures.restantes.heuresTech,
        progAssistant: heures.restantes.heuresAssistant,
        realTech: heures.effectuees.heuresTech,
        realAssistant: heures.effectuees.heuresAssistant,
        contratTech: parseHeures(s.nb_heures_vendues),
        contratAssistant: parseHeures(s.nb_heures_vendues_assistant),
        numClient,
        numSite,
      };
    })
    .sort((a, b) => a.numClient - b.numClient || a.numSite - b.numSite);
}

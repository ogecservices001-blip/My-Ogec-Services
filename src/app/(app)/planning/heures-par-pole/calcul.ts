import type { SupabaseClient } from "@supabase/supabase-js";
import type { Site } from "@/lib/types";
import { extraireNumero } from "@/lib/gmao/equipement-import";
import { dureeEnHeures } from "@/lib/bi/format";
import { Statuts, Poles } from "@/lib/bi/constants";

export type LigneHeuresParPole = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  heuresParPole: Record<string, number>;
  total: number;
  numClient: number;
  numSite: number;
};

const STATUTS_VALIDES = new Set<string>([Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye]);

/// Pôles de ce rapport — tous sauf Entretien sous contrat, déjà suivi
/// par /planning/audit-heures (heures de contrat) : celles-ci sont
/// facturées à part (prestation, dépannage...), jamais comparables au
/// même titre.
export const POLES_HEURES_PAR_POLE = [
  Poles.installationNeuve,
  Poles.remplacementIdentique,
  Poles.entretienHorsContrat,
  Poles.reparationEquipement,
  Poles.reparationDiverse,
  Poles.miseADisposition,
  Poles.livraisonMateriel,
  Poles.depannage,
] as const;

/// Heures de BI validés par site et par pôle (hors Entretien sous
/// contrat) — partagé par la page et l'export. Tous les sites (sous
/// contrat et hors contrat) : Installation neuve, Dépannage etc.
/// concernent n'importe quel client. Seuls les sites ayant au moins
/// une heure sur ces pôles sont retournés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculerLignesHeuresParPole(supabase: SupabaseClient<any>): Promise<LigneHeuresParPole[]> {
  const { data: sitesData } = await supabase.from("sites_view").select("*");
  const sites = (sitesData ?? []) as Site[];
  const siteIds = sites.map((s) => s.id);

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("site_id, temps_passe, statut, pole")
    .in("site_id", siteIds);

  const polesValides = new Set<string>(POLES_HEURES_PAR_POLE);
  const heuresParSiteEtPole = new Map<string, Map<string, number>>();
  for (const b of bons ?? []) {
    if (!b.site_id || !STATUTS_VALIDES.has(b.statut) || !polesValides.has(b.pole)) continue;
    const heures = dureeEnHeures(b.temps_passe) ?? 0;
    if (heures <= 0) continue;
    const parPole = heuresParSiteEtPole.get(b.site_id) ?? new Map<string, number>();
    parPole.set(b.pole, (parPole.get(b.pole) ?? 0) + heures);
    heuresParSiteEtPole.set(b.site_id, parPole);
  }

  return sites
    .map((s) => {
      const parts = s.n_affaire.split("-");
      const numClient = extraireNumero(parts[0] ?? "") ?? Number.MAX_SAFE_INTEGER;
      const numSite = extraireNumero(parts.slice(1).join("-") ?? "") ?? Number.MAX_SAFE_INTEGER;
      const parPole = heuresParSiteEtPole.get(s.id);
      const heuresParPole: Record<string, number> = {};
      let total = 0;
      for (const pole of POLES_HEURES_PAR_POLE) {
        const h = parPole?.get(pole) ?? 0;
        heuresParPole[pole] = h;
        total += h;
      }
      return { id: s.id, numero: s.n_affaire, clientNom: s.nom, clientSite: s.site, heuresParPole, total, numClient, numSite };
    })
    .filter((l) => l.total > 0)
    .sort((a, b) => a.numClient - b.numClient || a.numSite - b.numSite);
}

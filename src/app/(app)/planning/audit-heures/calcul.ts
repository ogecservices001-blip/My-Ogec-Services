import type { SupabaseClient } from "@supabase/supabase-js";
import type { Site } from "@/lib/types";
import { extraireNumero } from "@/lib/gmao/equipement-import";
import { dureeEnHeures } from "@/lib/bi/format";
import { Statuts } from "@/lib/bi/constants";

export type LigneAuditHeures = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  progTech: number;
  progAssistant: number;
  realTech: number;
  realAssistant: number;
  programmeesTech: number;
  contratTech: number;
  contratAssistant: number;
  numClient: number;
  numSite: number;
};

const STATUTS_VALIDES = new Set<string>([Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye]);

function parseHeures(v: string): number {
  const n = parseFloat(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/// Calcule l'audit heures pour tous les sites sous contrat — partagé
/// par la page et l'export, pour ne jamais faire diverger les deux.
///
/// "À programmer" = Total dû au contrat − Déjà réalisées − Programmées.
/// "Déjà réalisées" cumule : les créneaux de planning dont la date est
/// passée (réputés faits), + les heures des BI déjà validés — ces deux
/// sources peuvent en théorie se recouper (un créneau passé ET son BI
/// validé compteraient deux fois) tant qu'aucun lien direct créneau↔BI
/// n'existe ; acceptable tant que l'écart observé reste marginal.
/// "Programmées" = créneaux de planning à venir (pas encore réalisés).
/// Les créneaux ne distinguent pas Tech/Assistant : tout compte en
/// Tech, "Assistant" reste donc uniquement alimenté par le contrat.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculerLignesAuditHeures(supabase: SupabaseClient<any>): Promise<LigneAuditHeures[]> {
  const { data: sitesData } = await supabase.from("sites_view").select("*").eq("hors_contrat", false);
  const sites = (sitesData ?? []) as Site[];
  const siteIds = sites.map((s) => s.id);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [{ data: creneaux }, { data: bons }] = await Promise.all([
    supabase
      .from("creneaux_planning")
      .select("site_id, date, heures_prevues")
      .in("site_id", siteIds)
      .eq("annule", false)
      .not("site_id", "is", null),
    supabase.from("bons_intervention").select("site_id, temps_passe, statut").in("site_id", siteIds),
  ]);

  const programmeesParSite = new Map<string, number>();
  const realiseesParSite = new Map<string, number>();
  for (const c of creneaux ?? []) {
    const cible = c.date < aujourdhui ? realiseesParSite : programmeesParSite;
    cible.set(c.site_id, (cible.get(c.site_id) ?? 0) + Number(c.heures_prevues));
  }
  for (const b of bons ?? []) {
    if (!b.site_id || !STATUTS_VALIDES.has(b.statut)) continue;
    const heures = dureeEnHeures(b.temps_passe) ?? 0;
    realiseesParSite.set(b.site_id, (realiseesParSite.get(b.site_id) ?? 0) + heures);
  }

  return sites
    .map((s) => {
      const parts = s.n_affaire.split("-");
      const numClient = extraireNumero(parts[0] ?? "") ?? Number.MAX_SAFE_INTEGER;
      const numSite = extraireNumero(parts.slice(1).join("-") ?? "") ?? Number.MAX_SAFE_INTEGER;

      const contratTech = parseHeures(s.nb_heures_vendues);
      const contratAssistant = parseHeures(s.nb_heures_vendues_assistant);
      const programmeesTech = programmeesParSite.get(s.id) ?? 0;
      const realTech = realiseesParSite.get(s.id) ?? 0;

      return {
        id: s.id,
        numero: s.n_affaire,
        clientNom: s.nom,
        clientSite: s.site,
        progTech: Math.max(0, contratTech - realTech - programmeesTech),
        progAssistant: contratAssistant,
        realTech,
        realAssistant: 0,
        programmeesTech,
        contratTech,
        contratAssistant,
        numClient,
        numSite,
      };
    })
    .sort((a, b) => a.numClient - b.numClient || a.numSite - b.numSite);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Site } from "@/lib/types";
import { extraireNumero } from "@/lib/gmao/equipement-import";
import { dureeEnHeures } from "@/lib/bi/format";
import { Statuts } from "@/lib/bi/constants";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { heuresCumulAnnee } from "@/lib/gmao/calcul-heures-visite";
import type { Equipement, ReferenceHoraire } from "@/lib/gmao/types";

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
  executionTech: number;
  executionAssistant: number;
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
///
/// "Heure exécution" = heures Tech/Assistant par an que le parc
/// d'équipements du site exige réellement, recalculées équipement par
/// équipement depuis le catalogue Référentiel Heures + leur Fréquence
/// entretien annuelle (même calcul que le rapport d'import GMAO) — à
/// comparer au "Total dû au contrat" pour repérer un écart entre ce
/// qui est vendu et ce que le parc demande techniquement. Fiable
/// seulement pour les sites dont le parc GMAO est à jour.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculerLignesAuditHeures(supabase: SupabaseClient<any>): Promise<LigneAuditHeures[]> {
  const { data: sitesData } = await supabase.from("sites_view").select("*").eq("hors_contrat", false);
  const sites = (sitesData ?? []) as Site[];
  const siteIds = sites.map((s) => s.id);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [{ data: creneaux }, { data: bons }, { data: equipements }, { data: references }] = await Promise.all([
    supabase
      .from("creneaux_planning")
      .select("site_id, date, heures_prevues")
      .in("site_id", siteIds)
      .eq("annule", false)
      .not("site_id", "is", null),
    supabase.from("bons_intervention").select("site_id, temps_passe, statut").in("site_id", siteIds),
    supabase.from("equipements").select("site_id, champs_en_tete").in("site_id", siteIds),
    supabase.from("references_horaires").select("*"),
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

  const executionTechParSite = new Map<string, number>();
  const executionAssistantParSite = new Map<string, number>();
  for (const e of (equipements ?? []) as Pick<Equipement, "site_id" | "champs_en_tete">[]) {
    const champs = e.champs_en_tete;
    const resultat = analyserReference(champs, (references ?? []) as ReferenceHoraire[]);
    if (!resultat.reference) continue;
    const freqBrut = champs.freqEntretienAnnuelle;
    const freq = typeof freqBrut === "string" ? parseInt(freqBrut, 10) : NaN;
    if (!Number.isFinite(freq) || freq <= 0) continue;
    const cumul = heuresCumulAnnee(freq, resultat.reference);
    if (!cumul) continue;
    executionTechParSite.set(e.site_id, (executionTechParSite.get(e.site_id) ?? 0) + cumul.heuresTech);
    executionAssistantParSite.set(e.site_id, (executionAssistantParSite.get(e.site_id) ?? 0) + cumul.heuresAssistant);
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
        executionTech: executionTechParSite.get(s.id) ?? 0,
        executionAssistant: executionAssistantParSite.get(s.id) ?? 0,
        numClient,
        numSite,
      };
    })
    .sort((a, b) => a.numClient - b.numClient || a.numSite - b.numSite);
}

import type { SupabaseClient } from "@supabase/supabase-js";

/// Une intervention = les créneaux du même devis (prestation), ou du même
/// site pour la même visite n°/année (sous contrat). Un créneau sans l'un ni
/// l'autre est une intervention à lui seul. Une intervention = un seul BI.
export type CreneauIntervention = {
  id: string;
  site_id: string | null;
  devis_id: string | null;
  visite_numero: number | null;
  visite_annee: number | null;
  date: string;
};

export type BiIntervention = { id: string; numero: string; statut: string };

export function cleIntervention(c: Omit<CreneauIntervention, "date">): string {
  if (c.devis_id) return `d|${c.devis_id}`;
  if (c.site_id && c.visite_numero && c.visite_annee) return `v|${c.site_id}|${c.visite_annee}|${c.visite_numero}`;
  return `c|${c.id}`;
}

const COLONNES = "id, site_id, devis_id, visite_numero, visite_annee, date";

/// Tous les créneaux (non annulés) des interventions des créneaux donnés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function creneauxDesInterventions(supabase: SupabaseClient<any>, creneaux: CreneauIntervention[]): Promise<CreneauIntervention[]> {
  const devisIds = [...new Set(creneaux.map((c) => c.devis_id).filter((x): x is string => Boolean(x)))];
  const siteIds = [
    ...new Set(creneaux.filter((c) => !c.devis_id && c.visite_numero && c.visite_annee && c.site_id).map((c) => c.site_id as string)),
  ];
  const [parDevis, parSite] = await Promise.all([
    devisIds.length
      ? supabase.from("creneaux_planning").select(COLONNES).in("devis_id", devisIds).eq("annule", false)
      : Promise.resolve({ data: [] }),
    siteIds.length
      ? supabase.from("creneaux_planning").select(COLONNES).in("site_id", siteIds).is("devis_id", null).eq("annule", false)
      : Promise.resolve({ data: [] }),
  ]);
  const cles = new Set(creneaux.map(cleIntervention));
  const tous = new Map<string, CreneauIntervention>();
  for (const c of [...creneaux, ...((parDevis.data ?? []) as CreneauIntervention[]), ...((parSite.data ?? []) as CreneauIntervention[])]) {
    if (cles.has(cleIntervention(c))) tous.set(c.id, c);
  }
  return [...tous.values()];
}

/// BI déjà rattachés (par le planning) à un créneau de chaque intervention :
/// un BI transmis ou validé passe avant un brouillon.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function biDesInterventions(supabase: SupabaseClient<any>, creneaux: CreneauIntervention[]): Promise<Map<string, BiIntervention>> {
  const resultat = new Map<string, BiIntervention>();
  if (creneaux.length === 0) return resultat;
  const { data } = await supabase
    .from("bons_intervention")
    .select("id, numero, statut, creneau_id")
    .in("creneau_id", creneaux.map((c) => c.id));
  const creneauParId = new Map(creneaux.map((c) => [c.id, c]));
  for (const b of (data ?? []) as (BiIntervention & { creneau_id: string })[]) {
    const c = creneauParId.get(b.creneau_id);
    if (!c) continue;
    const cle = cleIntervention(c);
    const deja = resultat.get(cle);
    if (!deja || (deja.statut === "brouillon" && b.statut !== "brouillon")) resultat.set(cle, { id: b.id, numero: b.numero, statut: b.statut });
  }
  return resultat;
}

export function periodeIntervention(creneaux: CreneauIntervention[], cle: string): { debut: string; fin: string } | null {
  const dates = creneaux.filter((c) => cleIntervention(c) === cle).map((c) => c.date).sort();
  return dates.length ? { debut: dates[0], fin: dates[dates.length - 1] } : null;
}

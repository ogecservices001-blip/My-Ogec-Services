import type { Tables } from "@/lib/types";
import { groupeEntretien } from "@/lib/bi/constants";

type Bon = Tables<"bons_intervention">;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export type VisiteSaisie = { numero: number; total: number; annee: number };

export function libelleVisite(v: { numero: number | null; total: number | null; annee: number | null }): string {
  if (!v.numero) return "";
  return `Visite ${v.numero}${v.total ? ` de ${v.total}` : ""}${v.annee ? ` — ${v.annee}` : ""}`;
}

/// "jj/mm/aaaa" de fin de période (ou du début) → "aaaa-mm-jj" ; date du jour à défaut.
export function dateVisiteDuBon(bon: Pick<Bon, "date_fin" | "date_debut">): string {
  const m = (bon.date_fin || bon.date_debut || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return new Date().toISOString().slice(0, 10);
}

/// Équipements du site couverts par un BI Entretien sous contrat : ceux des
/// groupes cochés, sauf les non desservis.
export async function equipementsEntretenus(
  supabase: Supabase,
  bon: Pick<Bon, "site_id" | "entretien_groupes" | "entretien_non_desservis">,
): Promise<{ id: string; nom: string; freq: string }[]> {
  if (!bon.site_id || bon.entretien_groupes.length === 0) return [];
  const { data } = await supabase.from("equipements").select("id, nom, groupe, champs_en_tete").eq("site_id", bon.site_id);
  const nonDesservis = new Set(
    ((bon.entretien_non_desservis as { nom?: string }[] | null) ?? []).map((e) => e.nom).filter(Boolean),
  );
  return ((data ?? []) as { id: string; nom: string; groupe: string; champs_en_tete: Record<string, unknown> }[])
    .filter((eq) => bon.entretien_groupes.includes(groupeEntretien(eq.groupe)) && !nonDesservis.has(eq.nom))
    .map((eq) => ({
      id: eq.id,
      nom: eq.nom,
      freq: typeof eq.champs_en_tete?.freqEntretienAnnuelle === "string" ? (eq.champs_en_tete.freqEntretienAnnuelle as string) : "",
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/// Proposition pré-remplie à la validation : année de l'intervention, n° =
/// plus haut n° déjà validé cette année-là sur ces équipements + 1, total =
/// fréquence la plus courante. Le bureau corrige si besoin.
export async function proposerVisite(
  supabase: Supabase,
  bon: Pick<Bon, "date_fin" | "date_debut">,
  equipements: { id: string; freq: string }[],
): Promise<VisiteSaisie> {
  const annee = Number(dateVisiteDuBon(bon).slice(0, 4));
  const comptes = new Map<number, number>();
  for (const e of equipements) {
    const f = parseInt(e.freq, 10);
    if (Number.isFinite(f) && f >= 1 && f <= 12) comptes.set(f, (comptes.get(f) ?? 0) + 1);
  }
  const total = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
  let dernier = 0;
  if (equipements.length > 0) {
    const { data } = await supabase
      .from("visites_entretien")
      .select("visite_numero")
      .eq("annee", annee)
      .in("equipement_id", equipements.map((e) => e.id));
    for (const v of (data ?? []) as { visite_numero: number }[]) dernier = Math.max(dernier, v.visite_numero);
  }
  return { numero: Math.min(dernier + 1, total), total, annee };
}

export function controlerVisite(v: VisiteSaisie | null | undefined): string | null {
  if (!v) return "Renseigne le n° de visite d'entretien.";
  if (!Number.isInteger(v.total) || v.total < 1 || v.total > 12) return "Nombre de visites par an invalide (1 à 12).";
  if (!Number.isInteger(v.numero) || v.numero < 1 || v.numero > v.total) return `N° de visite invalide (1 à ${v.total}).`;
  if (!Number.isInteger(v.annee) || v.annee < 2020 || v.annee > 2100) return "Année de la visite invalide.";
  return null;
}

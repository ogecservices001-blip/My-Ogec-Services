import type { SupabaseClient } from "@supabase/supabase-js";
import type { LignePointage } from "./pointage";

/// Récapitulatif par salarié (port de la macro F_RecapPersonnelAnnuel) :
/// techniciens et cadres techniques, pas les administratifs.

export type LigneRecap = {
  cle: string;
  nom: string;
  total: number;
  hn: number;
  hs25: number;
  hs50: number;
  hs100: number;
  absences: Record<string, number>;
  paniersNb: number;
  paniersMontant: number;
  trajet: number;
  transport: number;
};

export type HeuresPole = { profileId: string; salarie: string; pole: string; mois: number; heures: number };

export const POLE_HORS_CLIENT = "HC";
export const MOTIF_AUTRE = "Autre absence";
const arrondi = (n: number) => Math.round(n * 100) / 100;

export async function chargerContexteRecap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
) {
  const [{ data: salaries }, { data: motifs }] = await Promise.all([
    supabase.from("rh_salaries").select("profile_id, nom_paie, categorie, actif"),
    supabase.from("rh_motifs_absence").select("motif, ordre").order("ordre"),
  ]);
  return {
    salaries: (salaries ?? []) as { profile_id: string | null; nom_paie: string; categorie: string; actif: boolean }[],
    motifs: ((motifs ?? []) as { motif: string }[]).map((m) => m.motif),
  };
}

export function recapParSalarie(
  lignes: LignePointage[],
  contexte: { salaries: { profile_id: string | null; nom_paie: string; categorie: string; actif: boolean }[]; motifs: string[] },
): { lignes: LigneRecap[]; motifs: string[] } {
  const administratifs = new Set(contexte.salaries.filter((s) => s.categorie === "administratif" && s.profile_id).map((s) => s.profile_id as string));
  const parCle = new Map<string, LigneRecap>();
  const vide = (cle: string, nom: string): LigneRecap => ({
    cle,
    nom,
    total: 0,
    hn: 0,
    hs25: 0,
    hs50: 0,
    hs100: 0,
    absences: {},
    paniersNb: 0,
    paniersMontant: 0,
    trajet: 0,
    transport: 0,
  });
  for (const s of contexte.salaries) {
    if (s.categorie !== "technique" || !s.actif) continue;
    const cle = s.profile_id ?? `nom-${s.nom_paie}`;
    parCle.set(cle, vide(cle, s.nom_paie));
  }
  const motifsConnus = new Set(contexte.motifs);
  let autre = false;
  for (const l of lignes) {
    if (administratifs.has(l.profileId)) continue;
    const r = parCle.get(l.profileId) ?? vide(l.profileId, l.salarie);
    parCle.set(l.profileId, r);
    if (l.source === "absence") {
      const motif = motifsConnus.has(l.motifAbsence) ? l.motifAbsence : MOTIF_AUTRE;
      if (motif === MOTIF_AUTRE) autre = true;
      r.absences[motif] = (r.absences[motif] ?? 0) + l.heures;
      r.total += l.heures;
    } else {
      r.hn += l.hn;
      r.hs25 += l.hs25;
      r.hs50 += l.hs50;
      r.hs100 += l.hs100;
      r.total += l.hn + l.hs25 + l.hs50 + l.hs100;
    }
    r.paniersNb += l.panierNb;
    r.paniersMontant += l.panierMontant;
    r.trajet += l.trajet;
    r.transport += l.transport;
  }
  const resultat = [...parCle.values()].map((r) => ({
    ...r,
    total: arrondi(r.total),
    hn: arrondi(r.hn),
    hs25: arrondi(r.hs25),
    hs50: arrondi(r.hs50),
    hs100: arrondi(r.hs100),
    absences: Object.fromEntries(Object.entries(r.absences).map(([k, v]) => [k, arrondi(v)])),
    paniersMontant: arrondi(r.paniersMontant),
    trajet: arrondi(r.trajet),
    transport: arrondi(r.transport),
  }));
  resultat.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { lignes: resultat, motifs: autre ? [...contexte.motifs, MOTIF_AUTRE] : contexte.motifs };
}

export function totalRecap(lignes: LigneRecap[], motifs: string[]): LigneRecap {
  const t: LigneRecap = { cle: "total", nom: "Total", total: 0, hn: 0, hs25: 0, hs50: 0, hs100: 0, absences: {}, paniersNb: 0, paniersMontant: 0, trajet: 0, transport: 0 };
  for (const l of lignes) {
    for (const k of ["total", "hn", "hs25", "hs50", "hs100", "paniersNb", "paniersMontant", "trajet", "transport"] as const) t[k] = arrondi(t[k] + l[k]);
    for (const m of motifs) t.absences[m] = arrondi((t.absences[m] ?? 0) + (l.absences[m] ?? 0));
  }
  return t;
}

/// Heures travaillées (hors absences) par salarié, pôle et mois.
export function heuresParPole(lignes: LignePointage[]): HeuresPole[] {
  const parCle = new Map<string, HeuresPole>();
  for (const l of lignes) {
    if (l.source === "absence") continue;
    const pole = l.pole || POLE_HORS_CLIENT;
    const mois = Number(l.date.slice(5, 7));
    const cle = `${l.profileId}|${pole}|${mois}`;
    const h = parCle.get(cle) ?? { profileId: l.profileId, salarie: l.salarie, pole, mois, heures: 0 };
    h.heures += l.heures;
    parCle.set(cle, h);
  }
  return [...parCle.values()].map((h) => ({ ...h, heures: arrondi(h.heures) }));
}

export function ordrePoles(poles: string[]): string[] {
  return [...new Set(poles)].sort((a, b) => (a === POLE_HORS_CLIENT ? 1 : b === POLE_HORS_CLIENT ? -1 : Number(a) - Number(b)));
}

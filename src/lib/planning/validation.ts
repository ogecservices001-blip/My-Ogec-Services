import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "./dates";
import { estJourOuvre } from "./periode";

export const URL_APPLI = process.env.NEXT_PUBLIC_SITE_URL || "https://my-ogec-services-my-ogec-services.vercel.app";
export const lienValidation = (token: string, base = URL_APPLI) => `${base.replace(/\/$/, "")}/v/${token}`;

export type StatutValidation = "attente" | "valide" | "autre_date" | "a_reproposer";
export type EtatValidation = { statut: StatutValidation; datePropose: string | null; moment: string };

/// État de validation client de chaque créneau : la dernière demande encore
/// active (non remplacée) qui le contient.
export async function chargerEtatsValidation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  creneauIds: string[],
): Promise<Map<string, EtatValidation>> {
  const resultat = new Map<string, EtatValidation>();
  if (creneauIds.length === 0) return resultat;
  const { data } = await supabase
    .from("demandes_validation_client")
    .select("creneau_ids, statut, motif_remplacement, date_proposee, moment, envoye_le")
    .overlaps("creneau_ids", creneauIds)
    .order("envoye_le", { ascending: true });
  for (const d of data ?? []) {
    const statut: StatutValidation | null =
      d.statut !== "remplacee"
        ? (d.statut as StatutValidation)
        : d.motif_remplacement === "modification" || d.motif_remplacement === "replanification"
          ? "a_reproposer"
          : null;
    for (const id of (d.creneau_ids as string[]) ?? []) {
      if (statut) resultat.set(id, { statut, datePropose: d.date_proposee, moment: d.moment });
      else resultat.delete(id);
    }
  }
  return resultat;
}

/// Nombre de jours ouvrés écoulés entre deux instants (week-ends et fériés exclus).
export function joursOuvresEcoules(depuis: Date, maintenant: Date, joursFeries: string[]): number {
  let d = depuis.toISOString().slice(0, 10);
  const fin = maintenant.toISOString().slice(0, 10);
  let n = 0;
  while (d < fin) {
    d = ajouterJours(d, 1);
    if (estJourOuvre(d, joursFeries)) n++;
  }
  return n;
}

/// `nb` jours ouvrés consécutifs à partir de `debut` (inclus s'il est ouvré).
export function joursOuvresAPartirDe(debut: string, nb: number, joursFeries: string[]): string[] {
  const jours: string[] = [];
  let d = debut;
  for (let i = 0; jours.length < nb && i < 90; i++, d = ajouterJours(d, 1)) {
    if (estJourOuvre(d, joursFeries)) jours.push(d);
  }
  return jours;
}

export const LIBELLE_VALIDATION: Record<StatutValidation, string> = {
  attente: "Attente validation client",
  valide: "Validé client",
  autre_date: "Autre date proposée",
  a_reproposer: "Date modifiée — à re-proposer au client",
};

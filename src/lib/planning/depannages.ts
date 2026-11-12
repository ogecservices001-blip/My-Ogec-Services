import type { SupabaseClient } from "@supabase/supabase-js";
import { dureeEnHeures } from "@/lib/bi/format";

/// Dépannages affichés sur le planning (jamais des créneaux : rien ne compte
/// dans l'Audit Heures du contrat).
/// - "fait" : BI de dépannage transmis ou validé, au jour d'intervention du
///   BI, pour chaque technicien noté sur le BI ;
/// - "a_faire" : demande assignée à un technicien pour un jour, sans BI
///   transmis.
export type DepannagePlanning = {
  cle: string;
  etat: "fait" | "a_faire";
  date: string;
  technicienIds: string[];
  client_nom: string;
  site: string;
  equipement: string;
  heures: number | null;
  numero: string;
  biId: string | null;
};

function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export async function chargerDepannagesPlanning(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  debutISO: string,
  finISO: string,
): Promise<DepannagePlanning[]> {
  const [{ data: bons }, { data: demandes }, { data: profils }] = await Promise.all([
    supabase
      .from("bons_intervention")
      .select("id, numero, statut, client_nom, site, equipement_nom, date_intervention, date_debut, temps_passe, techniciens")
      .eq("pole", "60")
      .neq("statut", "brouillon"),
    supabase
      .from("demandes_depannage")
      .select("id, numero, client_nom, client_site, equipement_nom, date_intervention_prevue, intervenant_id, bon_intervention_id")
      .not("intervenant_id", "is", null)
      .neq("statut", "traitee")
      .gte("date_intervention_prevue", debutISO)
      .lte("date_intervention_prevue", finISO),
    supabase.from("profiles").select("id, name"),
  ]);

  const idParNom = new Map((profils ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));
  const resultat: DepannagePlanning[] = [];
  const biTransmis = new Set<string>();

  for (const b of bons ?? []) {
    biTransmis.add(b.id);
    const date = isoDepuisFr(b.date_intervention || b.date_debut || "");
    if (!date || date < debutISO || date > finISO) continue;
    const technicienIds = ((b.techniciens as string[] | null) ?? [])
      .map((n) => idParNom.get(n.trim().toLowerCase()))
      .filter((x): x is string => Boolean(x));
    resultat.push({
      cle: `bi-${b.id}`,
      etat: "fait",
      date,
      technicienIds,
      client_nom: b.client_nom,
      site: b.site,
      equipement: b.equipement_nom,
      heures: dureeEnHeures(b.temps_passe ?? ""),
      numero: b.numero,
      biId: b.id,
    });
  }

  for (const d of demandes ?? []) {
    if (d.bon_intervention_id && biTransmis.has(d.bon_intervention_id)) continue;
    resultat.push({
      cle: `dem-${d.id}`,
      etat: "a_faire",
      date: d.date_intervention_prevue as string,
      technicienIds: [d.intervenant_id as string],
      client_nom: d.client_nom,
      site: d.client_site,
      equipement: d.equipement_nom,
      heures: null,
      numero: d.numero,
      biId: null,
    });
  }
  return resultat;
}

/// Heures de dépannage déjà faites par un technicien un jour donné (pour le
/// quota journalier).
export function heuresDepannageDuJour(depannages: DepannagePlanning[], technicienId: string, date: string): number {
  return depannages
    .filter((d) => d.etat === "fait" && d.date === date && d.technicienIds.includes(technicienId))
    .reduce((t, d) => t + (d.heures ?? 0), 0);
}

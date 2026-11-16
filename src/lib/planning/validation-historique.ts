import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "./dates";
import { estJourOuvre } from "./periode";

/// Historique d'une demande de validation client : chaque mail envoyé et
/// chaque décision, daté, pour ne jamais relancer un client à l'aveugle.
export type EvenementDemande =
  | "envoi"
  | "copie"
  | "relance_auto"
  | "relance_manuelle"
  | "sans_reponse"
  | "reponse_valide"
  | "reponse_autre_date"
  | "accepte_bureau"
  | "replanifie"
  | "date_modifiee"
  | "remplacee";

export type EntreeHistorique = { le: string; evenement: EvenementDemande; par: string; detail?: string };

export const LIBELLE_EVENEMENT: Record<EvenementDemande, string> = {
  envoi: "Demande envoyée au client",
  copie: "Copie d'information envoyée",
  relance_auto: "Relance automatique envoyée",
  relance_manuelle: "Relance manuelle envoyée",
  sans_reponse: "Alerte « sans réponse » envoyée au bureau",
  reponse_valide: "Le client a confirmé les dates",
  reponse_autre_date: "Le client propose d'autres dates",
  accepte_bureau: "Dates du client acceptées par le bureau (confirmation envoyée)",
  replanifie: "Le bureau replanifie lui-même",
  date_modifiee: "Date modifiée par le bureau : accord annulé",
  remplacee: "Remplacée par une nouvelle demande",
};

/// Événements qui correspondent à un mail reçu par le client.
export const MAILS_CLIENT: EvenementDemande[] = ["envoi", "relance_auto", "relance_manuelle", "accepte_bureau"];

export async function ajouterHistorique(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  demandeId: string,
  entree: Omit<EntreeHistorique, "le"> & { le?: string },
) {
  const { data } = await supabase.from("demandes_validation_client").select("historique").eq("id", demandeId).single();
  const historique = ((data?.historique as EntreeHistorique[] | null) ?? []).concat({ le: entree.le ?? new Date().toISOString(), ...entree });
  await supabase.from("demandes_validation_client").update({ historique }).eq("id", demandeId);
}

export const DELAI_RELANCE_JOURS_OUVRES = 3;

/// Date (AAAA-MM-JJ) à laquelle `n` jours ouvrés seront écoulés depuis `depuis`.
export function apresJoursOuvres(depuisISO: string, n: number, joursFeries: string[]): string {
  let d = depuisISO.slice(0, 10);
  let compte = 0;
  while (compte < n) {
    d = ajouterJours(d, 1);
    if (estJourOuvre(d, joursFeries)) compte++;
  }
  return d;
}

/// Prochaine action automatique d'une demande en attente (le passage du matin
/// suivant la date calculée).
export function prochaineActionAuto(
  d: { statut: string; envoye_le: string; relance1_le: string | null; relance2_le: string | null; sans_reponse_le: string | null },
  joursFeries: string[],
): { libelle: string; date: string } | null {
  if (d.statut !== "attente") return null;
  if (!d.relance1_le) return { libelle: "1re relance automatique", date: apresJoursOuvres(d.envoye_le, DELAI_RELANCE_JOURS_OUVRES, joursFeries) };
  if (!d.relance2_le) return { libelle: "2e relance automatique", date: apresJoursOuvres(d.relance1_le, DELAI_RELANCE_JOURS_OUVRES, joursFeries) };
  if (!d.sans_reponse_le) return { libelle: "Alerte « sans réponse » au bureau", date: apresJoursOuvres(d.relance2_le, DELAI_RELANCE_JOURS_OUVRES, joursFeries) };
  return null;
}

/// Historique d'une demande créée avant l'historique : reconstitué depuis ses dates.
export function historiqueComplet(d: {
  historique: unknown;
  envoye_le: string;
  relance1_le: string | null;
  relance2_le: string | null;
  sans_reponse_le: string | null;
  reponse_le: string | null;
  statut: string;
  destinataire_email: string;
}): EntreeHistorique[] {
  const h = (d.historique as EntreeHistorique[] | null) ?? [];
  if (h.length > 0) return h;
  const r: EntreeHistorique[] = [{ le: d.envoye_le, evenement: "envoi", par: "", detail: d.destinataire_email }];
  if (d.relance1_le) r.push({ le: d.relance1_le, evenement: "relance_auto", par: "Automatique" });
  if (d.relance2_le) r.push({ le: d.relance2_le, evenement: "relance_auto", par: "Automatique" });
  if (d.sans_reponse_le) r.push({ le: d.sans_reponse_le, evenement: "sans_reponse", par: "Automatique" });
  if (d.reponse_le) r.push({ le: d.reponse_le, evenement: d.statut === "autre_date" ? "reponse_autre_date" : "reponse_valide", par: "Client" });
  return r;
}

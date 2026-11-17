import type { SupabaseClient } from "@supabase/supabase-js";
import { Statuts } from "@/lib/bi/constants";

/// Un devis ne passe Facturable que quand toutes ses interventions sont
/// faites : aucun BI en brouillon ou à vérifier, aucun créneau à venir.
/// `biValideEnCours` : BI en train d'être validé, compté comme validé.
export async function blocageFacturationDevis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  devisId: string,
  biValideEnCours?: string,
): Promise<string | null> {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [{ data: bons }, { data: creneaux }] = await Promise.all([
    supabase.from("bons_intervention").select("id, numero, statut").eq("devis_id", devisId),
    supabase.from("creneaux_planning").select("id").eq("devis_id", devisId).eq("annule", false).gt("date", aujourdhui),
  ]);
  const nonValides = ((bons ?? []) as { id: string; numero: string; statut: string }[]).filter(
    (b) => b.id !== biValideEnCours && (b.statut === Statuts.brouillon || b.statut === Statuts.aVerifier),
  );
  const raisons: string[] = [];
  if (nonValides.length) {
    const liste = nonValides.map((b) => b.numero || "brouillon").join(", ");
    raisons.push(`${nonValides.length} BI de ce devis pas encore validé${nonValides.length > 1 ? "s" : ""} (${liste})`);
  }
  const nbCreneaux = (creneaux ?? []).length;
  if (nbCreneaux) raisons.push(`${nbCreneaux} intervention${nbCreneaux > 1 ? "s" : ""} encore planifiée${nbCreneaux > 1 ? "s" : ""}`);
  return raisons.length ? `Le devis ne peut pas encore passer Facturable : ${raisons.join(" et ")}.` : null;
}

/// "dd/mm/yyyy" → "MM-AAAA".
export function moisDepuisDateFr(date: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((date ?? "").trim());
  return m ? `${m[2]}-${m[3]}` : "";
}

export type InfosFacturationDevis = {
  id: string;
  numero: string;
  montant: number | null;
  montantCommande: number | null;
  ecart: number | null;
  ecartAConfirmer: boolean;
  moisFacturation: string;
  facturableParBi: string;
  blocage: string | null;
  moisPropose: string;
};

export async function chargerInfosFacturationDevis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bon: { id: string; devis_id: string | null; date_intervention: string; date_fin: string; date_debut: string },
): Promise<InfosFacturationDevis | null> {
  if (!bon.devis_id) return null;
  const { data: devis } = await supabase
    .from("devis")
    .select("id, numero, montant, montant_commande, ecart_commande_confirme, mois_facturation, facturable_par_bi, annule")
    .eq("id", bon.devis_id)
    .maybeSingle();
  if (!devis || devis.annule) return null;
  const ecartBrut = devis.montant_commande !== null && devis.montant !== null ? Math.round((devis.montant_commande - devis.montant) * 100) / 100 : null;
  const ecart = ecartBrut !== null && Math.abs(ecartBrut) >= 0.01 ? ecartBrut : null;
  const maintenant = new Date().toISOString();
  return {
    id: devis.id,
    numero: devis.numero,
    montant: devis.montant,
    montantCommande: devis.montant_commande,
    ecart,
    ecartAConfirmer: ecart !== null && !devis.ecart_commande_confirme,
    moisFacturation: devis.mois_facturation ?? "",
    facturableParBi: devis.facturable_par_bi ?? "",
    blocage: await blocageFacturationDevis(supabase, devis.id, bon.id),
    moisPropose:
      moisDepuisDateFr(bon.date_intervention) || moisDepuisDateFr(bon.date_fin) || moisDepuisDateFr(bon.date_debut) || `${maintenant.slice(5, 7)}-${maintenant.slice(0, 4)}`,
  };
}

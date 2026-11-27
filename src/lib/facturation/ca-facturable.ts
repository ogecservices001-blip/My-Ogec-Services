import type { SupabaseClient } from "@supabase/supabase-js";
import { Statuts, sansMontant } from "@/lib/bi/constants";
import { montantDeplacements, montantMainDoeuvre, totalHT, type Presta, type TauxSite } from "@/lib/bi/format";

export const STATUTS_BI_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

/// Montant HT d'un BI hors devis : main d'œuvre (taux de régie du site) +
/// déplacements + fournitures. Null pour une prestation sur devis (le prix
/// est celui du devis). Même calcul que « Bons validés ».
export function montantBi(
  b: {
    pole: string;
    devis_id: string | null;
    temps_passe: string;
    nombre_deplacements: number;
    prestas: unknown;
    interventions_supplementaires: unknown;
  },
  taux: TauxSite,
): number | null {
  if (sansMontant(b.pole, b.devis_id)) return null;
  const montantHeures = montantMainDoeuvre(b.temps_passe, taux) ?? 0;
  const montantDepl = montantDeplacements(b.nombre_deplacements, taux) ?? 0;
  const prestas = [
    ...((b.prestas as Presta[] | null) ?? []),
    ...((b.interventions_supplementaires as { prestas?: Presta[] }[] | null) ?? []).flatMap((i) => i.prestas ?? []),
  ];
  return montantHeures + montantDepl + totalHT(prestas);
}

export type LigneCa = {
  type: "devis" | "bi";
  id: string;
  href: string;
  /// « MM-AAAA »
  mois: string;
  numero: string;
  client: string;
  site: string;
  libelle: string;
  montant: number;
};

const MOIS = /^(\d{2})-(\d{4})$/;

/// CA facturable : devis passés « Facturable » (montant du devis) + BI hors
/// devis classés « À facturer » (montant calculé), rangés par mois de
/// facturation. Un BI sur devis n'est jamais compté : son prix est celui du
/// devis, déjà compté.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chargerCaFacturable(supabase: SupabaseClient<any>): Promise<LigneCa[]> {
  const [{ data: devis }, { data: bons }, { data: sites }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, numero, site_id, libelle, montant, mois_facturation, annule")
      .neq("mois_facturation", "")
      .eq("annule", false),
    supabase
      .from("bons_intervention")
      .select("id, numero, pole, client_nom, site, site_id, devis_id, equipement_nom, compte_rendu, mois_facturation, classement, temps_passe, nombre_deplacements, prestas, interventions_supplementaires")
      .in("statut", STATUTS_BI_VALIDES)
      .eq("classement", "facturer")
      .neq("mois_facturation", "")
      .is("devis_id", null),
    supabase.from("sites").select("id, nom, site, taux_horaire_regie, forfait_deplacement"),
  ]);
  const siteParId = new Map((sites ?? []).map((s) => [s.id as string, s]));

  const lignes: LigneCa[] = [];
  for (const d of devis ?? []) {
    if (!d.numero || !MOIS.test(String(d.mois_facturation).trim())) continue;
    const s = siteParId.get(d.site_id);
    lignes.push({
      type: "devis",
      id: d.id,
      href: `/devis/${d.id}/statut`,
      mois: String(d.mois_facturation).trim(),
      numero: d.numero,
      client: s?.nom ?? "",
      site: s?.site ?? "",
      libelle: d.libelle ?? "",
      montant: Number(d.montant ?? 0),
    });
  }
  for (const b of bons ?? []) {
    if (!MOIS.test(String(b.mois_facturation).trim())) continue;
    const s = b.site_id ? siteParId.get(b.site_id) : undefined;
    const montant = montantBi(b, s ?? null);
    if (montant === null) continue;
    lignes.push({
      type: "bi",
      id: b.id,
      href: `/bi/${b.id}`,
      mois: String(b.mois_facturation).trim(),
      numero: b.numero,
      client: b.client_nom,
      site: b.site,
      libelle: b.equipement_nom || (b.compte_rendu ?? "").split("\n")[0].slice(0, 80),
      montant,
    });
  }
  return lignes;
}

export const cleMois = (mois: string) => {
  const m = MOIS.exec(mois);
  return m ? `${m[2]}-${m[1]}` : "";
};

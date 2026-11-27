import type { SupabaseClient } from "@supabase/supabase-js";
import { Poles, Statuts } from "@/lib/bi/constants";

/// Un dépannage sur un équipement : une demande de dépannage (bureau ou QR),
/// ou un BI de dépannage fait sans demande (technicien sur place). Un BI lié
/// à une demande n'est compté qu'une fois, via la demande.
export type DepannageEquipement = {
  cle: string;
  equipementId: string;
  siteId: string | null;
  equipementNom: string;
  client: string;
  site: string;
  /// AAAA-MM-JJ
  date: string;
  numero: string;
};

function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chargerDepannagesEquipements(supabase: SupabaseClient<any>, siteId?: string): Promise<DepannageEquipement[]> {
  let reqDemandes = supabase
    .from("demandes_depannage")
    .select("id, numero, equipement_id, site_id, equipement_nom, client_nom, client_site, date_creation")
    .not("equipement_id", "is", null);
  let reqBons = supabase
    .from("bons_intervention")
    .select("id, numero, equipement_id, equipement_nom, site_id, client_nom, site, date_intervention, date_debut, created_at, interventions_supplementaires")
    .eq("pole", Poles.depannage)
    .neq("statut", Statuts.brouillon)
    .is("depannage_id", null);
  if (siteId) {
    reqDemandes = reqDemandes.eq("site_id", siteId);
    reqBons = reqBons.eq("site_id", siteId);
  }
  const [{ data: demandes }, { data: bons }] = await Promise.all([reqDemandes, reqBons]);

  const resultat: DepannageEquipement[] = [];
  for (const d of demandes ?? []) {
    resultat.push({
      cle: `dem-${d.id}`,
      equipementId: d.equipement_id as string,
      siteId: d.site_id,
      equipementNom: d.equipement_nom,
      client: d.client_nom,
      site: d.client_site,
      date: String(d.date_creation).slice(0, 10),
      numero: `N°${d.numero}`,
    });
  }
  for (const b of bons ?? []) {
    const date = isoDepuisFr(b.date_intervention || b.date_debut) || String(b.created_at).slice(0, 10);
    const equipements = new Map<string, string>();
    if (b.equipement_id) equipements.set(b.equipement_id, b.equipement_nom);
    for (const i of (b.interventions_supplementaires as { equipement_id?: string | null; equipement_nom?: string }[] | null) ?? []) {
      if (i.equipement_id && !equipements.has(i.equipement_id)) equipements.set(i.equipement_id, i.equipement_nom ?? "");
    }
    for (const [equipementId, nom] of equipements) {
      resultat.push({
        cle: `bi-${b.id}-${equipementId}`,
        equipementId,
        siteId: b.site_id,
        equipementNom: nom,
        client: b.client_nom,
        site: b.site,
        date,
        numero: b.numero,
      });
    }
  }
  return resultat;
}

/// Date d'il y a 12 mois (AAAA-MM-JJ).
export function ilYaDouzeMois(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

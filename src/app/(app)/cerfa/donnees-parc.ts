import { createClient } from "@/lib/supabase/server";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";
import { FAMILLES_CERFA, lireDateFr, statutSoumission, texteChamp, type StatutSoumission } from "@/lib/cerfa/regles";

export type EquipementParc = {
  id: string;
  nom: string;
  numero: string;
  client: string;
  site: string;
  siteId: string;
  nAffaire: string;
  fluide: string;
  charge: string;
  dernierControle: string;
  prochainControle: string;
  prochainDate: Date | null;
  statut: StatutSoumission;
};

type Ligne = {
  id: string;
  nom: string;
  numero_equipement: string;
  site_id: string;
  champs_en_tete: ChampsEnTeteEquipement;
  sites: { nom: string; site: string; n_affaire: string } | null;
};

/// Tous les équipements à fluide du parc, avec leur statut CERFA (charge
/// > 2 kg, ≤ 2 kg ou charge inconnue).
export async function chargerParcCerfa(): Promise<EquipementParc[]> {
  const supabase = await createClient();
  const lignes = await recupererToutesLesLignes<Ligne>((debut, fin) =>
    supabase
      .from("equipements")
      .select("id, nom, numero_equipement, site_id, champs_en_tete, sites(nom, site, n_affaire)")
      .in("type_equipement_id", FAMILLES_CERFA)
      .order("numero_equipement")
      .range(debut, fin) as unknown as PromiseLike<{ data: Ligne[] | null; error: { message: string } | null }>,
  );
  return lignes.map((l) => {
    const c = l.champs_en_tete ?? {};
    const prochain = texteChamp(c, "dateProchainControle");
    return {
      id: l.id,
      nom: l.nom,
      numero: l.numero_equipement,
      client: l.sites?.nom ?? "",
      site: l.sites?.site ?? "",
      siteId: l.site_id,
      nAffaire: l.sites?.n_affaire ?? "",
      fluide: texteChamp(c, "typeRefrigerant"),
      charge: texteChamp(c, "chargeRefrigerant"),
      dernierControle: texteChamp(c, "dateDernierControle"),
      prochainControle: prochain,
      prochainDate: lireDateFr(prochain),
      statut: statutSoumission(c),
    };
  });
}

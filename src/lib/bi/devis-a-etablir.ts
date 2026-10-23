import { createClient } from "@/lib/supabase/server";
import { Poles } from "./constants";
import type { InterventionEquipement } from "./format";

export type DevisAEtablir = {
  equipementId: string;
  equipementNom: string;
  clientNom: string;
  site: string;
  siteId: string | null;
  biNumero: string;
  compteRendu: string;
};

type EntreeBI = { equipement_id: string | null; equipement_nom: string; compte_rendu: string; etat_equipement: string[] };

function entreesDuBon(b: {
  equipement_id: string | null;
  equipement_nom: string;
  compte_rendu: string;
  etat_equipement: unknown;
  interventions_supplementaires: unknown;
}): EntreeBI[] {
  const primaire: EntreeBI = {
    equipement_id: b.equipement_id,
    equipement_nom: b.equipement_nom,
    compte_rendu: b.compte_rendu,
    etat_equipement: (b.etat_equipement as string[] | null) ?? [],
  };
  const supplementaires = ((b.interventions_supplementaires as InterventionEquipement[] | null) ?? []).map((i) => ({
    equipement_id: i.equipement_id,
    equipement_nom: i.equipement_nom,
    compte_rendu: i.compte_rendu,
    etat_equipement: i.etat_equipement ?? [],
  }));
  return [primaire, ...supplementaires];
}

/// Équipements signalés "Devis à établir" par un BI Dépannage, tant
/// qu'aucun vrai devis (non annulé) n'est déjà lié à cet équipement —
/// pas de lien à saisir à la main, la liste se vide toute seule dès
/// qu'un devis est créé pour l'équipement concerné. `siteIds` limite le
/// résultat à ces sites (récap Répertoire) ; omis = tous les sites.
export async function chargerDevisAEtablir(siteIds?: string[]): Promise<DevisAEtablir[]> {
  const supabase = await createClient();
  let requete = supabase
    .from("bons_intervention")
    .select("numero, client_nom, site, site_id, equipement_id, equipement_nom, compte_rendu, etat_equipement, interventions_supplementaires")
    .eq("pole", Poles.depannage);
  if (siteIds) requete = requete.in("site_id", siteIds);

  const [{ data: bons }, { data: devisExistants }] = await Promise.all([
    requete,
    supabase.from("devis").select("equipement_id").eq("annule", false).not("equipement_id", "is", null),
  ]);

  const equipementsAvecDevis = new Set((devisExistants ?? []).map((d) => d.equipement_id));
  const vus = new Set<string>();
  const resultats: DevisAEtablir[] = [];

  for (const b of bons ?? []) {
    for (const entree of entreesDuBon(b)) {
      if (!entree.equipement_id || !entree.etat_equipement.includes("devis_a_etablir")) continue;
      if (equipementsAvecDevis.has(entree.equipement_id)) continue;
      const cle = `${entree.equipement_id}-${b.numero}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      resultats.push({
        equipementId: entree.equipement_id,
        equipementNom: entree.equipement_nom,
        clientNom: b.client_nom,
        site: b.site,
        siteId: b.site_id,
        biNumero: b.numero,
        compteRendu: entree.compte_rendu,
      });
    }
  }

  return resultats;
}

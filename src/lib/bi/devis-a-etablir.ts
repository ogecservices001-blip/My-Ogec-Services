import { createClient } from "@/lib/supabase/server";
import { Poles } from "./constants";
import type { InterventionEquipement } from "./format";

export type DevisAEtablir = {
  equipementId: string | null;
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

function cleSignalement(biNumero: string, equipementNom: string): string {
  return `${biNumero}|${equipementNom}`;
}

/// Écran de création du devis, pré-rempli depuis le signalement. Sans
/// équipement connu (texte libre), le site et le signalement prennent
/// le relais de l'équipement.
export function lienCreerDevis(a: DevisAEtablir): string {
  const params = new URLSearchParams({ compteRendu: a.compteRendu });
  if (a.equipementId) {
    params.set("equipementId", a.equipementId);
  } else {
    if (a.siteId) params.set("siteId", a.siteId);
    params.set("signalement", cleSignalement(a.biNumero, a.equipementNom));
    params.set("equipementNom", a.equipementNom);
  }
  return `/devis/nouveau?${params.toString()}`;
}

/// Équipements signalés "Devis à établir" par un BI Dépannage transmis,
/// tant qu'aucun devis (non annulé) n'y répond : lié à l'équipement, ou
/// créé depuis ce signalement pour un équipement en texte libre. La
/// liste se vide toute seule à la création du devis. `siteIds` limite le
/// résultat à ces sites (récap Répertoire) ; omis = tous les sites.
export async function chargerDevisAEtablir(siteIds?: string[]): Promise<DevisAEtablir[]> {
  const supabase = await createClient();
  let requete = supabase
    .from("bons_intervention")
    .select("numero, client_nom, site, site_id, equipement_id, equipement_nom, compte_rendu, etat_equipement, interventions_supplementaires")
    .eq("pole", Poles.depannage)
    .neq("statut", "brouillon");
  if (siteIds) requete = requete.in("site_id", siteIds);

  const [{ data: bons }, { data: devisExistants }] = await Promise.all([
    requete,
    supabase.from("devis").select("equipement_id, signalement_bi").eq("annule", false),
  ]);

  const equipementsAvecDevis = new Set((devisExistants ?? []).map((d) => d.equipement_id).filter(Boolean));
  const signalementsAvecDevis = new Set((devisExistants ?? []).map((d) => d.signalement_bi).filter(Boolean));
  const vus = new Set<string>();
  const resultats: DevisAEtablir[] = [];

  for (const b of bons ?? []) {
    for (const entree of entreesDuBon(b)) {
      if (!entree.etat_equipement.includes("devis_a_etablir")) continue;
      const equipementNom = entree.equipement_nom || "Équipement non précisé";
      const dejaTraite = entree.equipement_id
        ? equipementsAvecDevis.has(entree.equipement_id)
        : signalementsAvecDevis.has(cleSignalement(b.numero, equipementNom));
      if (dejaTraite) continue;
      const cle = `${entree.equipement_id ?? equipementNom}-${b.numero}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      resultats.push({
        equipementId: entree.equipement_id,
        equipementNom,
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

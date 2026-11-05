import { createClient } from "@/lib/supabase/server";
import { Poles } from "./constants";
import type { InterventionEquipement } from "./format";

/// Une ligne par BI : tous ses équipements signalés partent sur un seul devis.
export type DevisAEtablir = {
  equipementIds: string[];
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

/// Écran de création du devis, pré-rempli depuis le signalement.
export function lienCreerDevis(a: DevisAEtablir): string {
  const params = new URLSearchParams({
    compteRendu: a.compteRendu,
    signalement: a.biNumero,
    equipementNom: a.equipementNom,
  });
  if (a.siteId) params.set("siteId", a.siteId);
  if (a.equipementIds.length > 0) params.set("equipementIds", a.equipementIds.join(","));
  return `/devis/nouveau?${params.toString()}`;
}

/// Équipements signalés "Devis à établir" par un BI Dépannage transmis,
/// regroupés par BI, tant qu'aucun devis (non annulé) n'y répond : créé
/// depuis ce BI, ou déjà lié à l'équipement. La liste se vide toute seule
/// à la création du devis. `siteIds` limite le résultat à ces sites (récap
/// Répertoire) ; omis = tous les sites.
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
    supabase.from("devis").select("equipement_id, equipements_supplementaires, signalement_bi").eq("annule", false),
  ]);

  const equipementsAvecDevis = new Set(
    (devisExistants ?? []).flatMap((d) => [d.equipement_id, ...d.equipements_supplementaires]).filter(Boolean),
  );
  const bonsAvecDevis = new Set((devisExistants ?? []).map((d) => d.signalement_bi.split("|")[0]).filter(Boolean));
  const resultats: DevisAEtablir[] = [];

  for (const b of bons ?? []) {
    if (bonsAvecDevis.has(b.numero)) continue;

    const vus = new Set<string>();
    const entrees = entreesDuBon(b)
      .filter((e) => e.etat_equipement.includes("devis_a_etablir"))
      .filter((e) => !e.equipement_id || !equipementsAvecDevis.has(e.equipement_id))
      .map((e) => ({ ...e, equipement_nom: e.equipement_nom || "Équipement non précisé" }))
      .filter((e) => {
        const cle = e.equipement_id ?? e.equipement_nom;
        if (vus.has(cle)) return false;
        vus.add(cle);
        return true;
      });
    if (entrees.length === 0) continue;

    resultats.push({
      equipementIds: entrees.map((e) => e.equipement_id).filter((id): id is string => Boolean(id)),
      equipementNom: entrees.map((e) => e.equipement_nom).join(", "),
      clientNom: b.client_nom,
      site: b.site,
      siteId: b.site_id,
      biNumero: b.numero,
      compteRendu:
        entrees.length === 1
          ? entrees[0].compte_rendu
          : entrees.map((e) => `${e.equipement_nom} : ${e.compte_rendu}`).join(" / "),
    });
  }

  return resultats;
}

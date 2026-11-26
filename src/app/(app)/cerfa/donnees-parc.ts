import { createClient } from "@/lib/supabase/server";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";
import { FAMILLES_CERFA, fluideCerfa, lireDateFr, statutSoumission, texteChamp, type StatutSoumission } from "@/lib/cerfa/regles";

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

export type ClassementParc = {
  soumis: EquipementParc[];
  aJour: EquipementParc[];
  enRetard: EquipementParc[];
  dansLeMois: EquipementParc[];
  chargeARelever: EquipementParc[];
};

/// Même règle que l'ancien « Point sur les CERFA » : soumis = charge > 2 kg ;
/// en retard = prochain contrôle dépassé ou jamais contrôlé ; dans le mois =
/// à jour mais dû dans les 30 jours.
export function classerParc(parc: EquipementParc[], maintenant = new Date()): ClassementParc {
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const dansUnMois = new Date(aujourdhui.getTime() + 30 * 86400000);
  const parDate = (a: EquipementParc, b: EquipementParc) => (a.prochainDate?.getTime() ?? 0) - (b.prochainDate?.getTime() ?? 0);
  const soumis = parc.filter((e) => e.statut === "soumis");
  const enRetard = soumis.filter((e) => !e.prochainDate || e.prochainDate < aujourdhui).sort(parDate);
  const aJour = soumis.filter((e) => e.prochainDate && e.prochainDate >= aujourdhui).sort(parDate);
  const dansLeMois = aJour.filter((e) => e.prochainDate! <= dansUnMois);
  const chargeARelever = parc.filter((e) => e.statut === "charge_inconnue");
  return { soumis, aJour, enRetard, dansLeMois, chargeARelever };
}

export type LigneDeclaration = {
  fluide: string;
  nbCerfa: number;
  chargeesNeufs: number;
  chargeesMaintenance: number;
  recupMaintenance: number;
  recupHorsUsage: number;
};

/// Déclaration annuelle des quantités de fluide (anciennes colonnes Y à AB du
/// Google Sheet), totalisée par fluide à partir des CERFA de l'année.
export async function chargerDeclarationAnnuelle(annee: number): Promise<LigneDeclaration[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cerfas")
    .select("donnees, qte_chargees_neufs, qte_chargees_maintenance, qte_recup_maintenance, qte_recup_hors_usage, equipements(champs_en_tete)")
    .eq("annee", annee);
  const parFluide = new Map<string, LigneDeclaration>();
  for (const c of data ?? []) {
    const d = (c.donnees ?? {}) as { equipementFluide?: string };
    const eq = (Array.isArray(c.equipements) ? c.equipements[0] : c.equipements) as { champs_en_tete: ChampsEnTeteEquipement } | null;
    const fluide = d.equipementFluide || fluideCerfa(texteChamp(eq?.champs_en_tete ?? {}, "typeRefrigerant")) || "Non renseigné";
    const l = parFluide.get(fluide) ?? { fluide, nbCerfa: 0, chargeesNeufs: 0, chargeesMaintenance: 0, recupMaintenance: 0, recupHorsUsage: 0 };
    l.nbCerfa += 1;
    l.chargeesNeufs += Number(c.qte_chargees_neufs ?? 0);
    l.chargeesMaintenance += Number(c.qte_chargees_maintenance ?? 0);
    l.recupMaintenance += Number(c.qte_recup_maintenance ?? 0);
    l.recupHorsUsage += Number(c.qte_recup_hors_usage ?? 0);
    parFluide.set(fluide, l);
  }
  return [...parFluide.values()].sort((a, b) => a.fluide.localeCompare(b.fluide, "fr"));
}

export async function anneesCerfa(): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("cerfas").select("annee");
  const annees = new Set((data ?? []).map((c) => c.annee));
  annees.add(new Date().getFullYear());
  return [...annees].sort((a, b) => b - a);
}

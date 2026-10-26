import { createClient } from "@/lib/supabase/server";
import { Statuts, labelPole } from "@/lib/bi/constants";
import { montantMainDoeuvre, montantDeplacements, totalHT, type Presta, type TauxSite } from "@/lib/bi/format";
import { chargerDevisAEtablir } from "@/lib/bi/devis-a-etablir";

export type LigneRecap = {
  id: string;
  numero: string;
  libelle: string;
  montant: number | null;
  href: string;
};

export type RecapDevis = {
  aEtablir: LigneRecap[];
  envoye: LigneRecap[];
  aRealiser: LigneRecap[];
  realises: LigneRecap[];
};

export type RecapBi = {
  classer: LigneRecap[];
  facturer: LigneRecap[];
  receptionTravaux: LigneRecap[];
  maintenance: LigneRecap[];
};

export type RecapDepannages = {
  enCours: LigneRecap[];
  traitees: LigneRecap[];
};

const STATUTS_REALISE_BI = new Set<string>(Object.values(Statuts).filter((s) => s !== Statuts.brouillon));
const STATUTS_VALIDES_BI = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

/// Récap Devis pour le Répertoire (fiche site ou fiche client) — mêmes
/// 4 étapes que le module Devis (voir devis/statut.ts), mais "Envoyé"
/// et "À réaliser" plutôt que "attente"/"commande" : vocabulaire du
/// Répertoire, pas celui, plus technique, du module Devis.
export async function chargerRecapDevis(siteIds: string[]): Promise<RecapDevis> {
  const aEtablirBruts = siteIds.length > 0 ? await chargerDevisAEtablir(siteIds) : [];
  const aEtablir: LigneRecap[] = aEtablirBruts.map((d) => ({
    id: d.equipementId,
    numero: d.biNumero,
    libelle: d.equipementNom,
    montant: null,
    href: `/devis/nouveau?equipementId=${d.equipementId}&compteRendu=${encodeURIComponent(d.compteRendu)}`,
  }));

  if (siteIds.length === 0) {
    return { aEtablir, envoye: [], aRealiser: [], realises: [] };
  }

  const supabase = await createClient();
  const [{ data: devis }, { data: bons }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, numero, libelle, montant, date_commande_client, bi_reference_historique, annule")
      .in("site_id", siteIds),
    supabase.from("bons_intervention").select("devis_id, statut").in("site_id", siteIds).not("devis_id", "is", null),
  ]);

  const devisRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_REALISE_BI.has(b.statut)).map((b) => b.devis_id as string),
  );

  const envoye: LigneRecap[] = [];
  const aRealiser: LigneRecap[] = [];
  const realises: LigneRecap[] = [];
  for (const d of devis ?? []) {
    if (d.annule) continue;
    const ligne: LigneRecap = {
      id: d.id,
      numero: d.numero || "(sans référence)",
      libelle: d.libelle,
      montant: d.montant,
      href: `/devis/${d.id}/statut`,
    };
    const realise = devisRealises.has(d.id) || Boolean(d.bi_reference_historique);
    if (realise) realises.push(ligne);
    else if (d.date_commande_client) aRealiser.push(ligne);
    else envoye.push(ligne);
  }

  return { aEtablir, envoye, aRealiser, realises };
}

/// Récap Bon d'intervention pour le Répertoire — uniquement les bons
/// déjà validés (classement obligatoire, voir BlocClassement côté BI),
/// groupés par classement. Le montant est recalculé au taux régie du
/// site de CE bon (pas un taux unique : chaque site a le sien).
export async function chargerRecapBI(siteIds: string[]): Promise<RecapBi> {
  const groupes: RecapBi = { classer: [], facturer: [], receptionTravaux: [], maintenance: [] };
  if (siteIds.length === 0) return groupes;

  const supabase = await createClient();
  const [{ data: bons }, { data: sites }] = await Promise.all([
    supabase
      .from("bons_intervention")
      .select("id, numero, pole, classement, site_id, temps_passe, nombre_deplacements, prestas, interventions_supplementaires")
      .in("site_id", siteIds)
      .in("statut", STATUTS_VALIDES_BI),
    supabase.from("sites").select("id, taux_horaire_regie, forfait_deplacement").in("id", siteIds),
  ]);
  const tauxParSite = new Map((sites ?? []).map((s) => [s.id, s]));

  for (const b of bons ?? []) {
    const taux: TauxSite = (b.site_id ? tauxParSite.get(b.site_id) : undefined) ?? null;
    const montantHeures = montantMainDoeuvre(b.temps_passe, taux) ?? 0;
    const montantDepl = montantDeplacements(b.nombre_deplacements, taux) ?? 0;
    const prestas = [
      ...(b.prestas as unknown as Presta[]),
      ...(b.interventions_supplementaires as unknown as { prestas: Presta[] }[]).flatMap((i) => i.prestas ?? []),
    ];
    const ligne: LigneRecap = {
      id: b.id,
      numero: b.numero || "BI (brouillon)",
      libelle: labelPole(b.pole),
      montant: montantHeures + montantDepl + totalHT(prestas),
      href: `/bi/${b.id}`,
    };
    if (b.classement === "facturer") groupes.facturer.push(ligne);
    else if (b.classement === "reception_travaux") groupes.receptionTravaux.push(ligne);
    else if (b.classement === "maintenance") groupes.maintenance.push(ligne);
    else groupes.classer.push(ligne);
  }

  return groupes;
}

/// Récap Suivi Dépannages pour le Répertoire — même découpage que la
/// liste elle-même (voir DepannagesListe) : "traitee" vs le reste.
export async function chargerRecapDepannages(siteIds: string[]): Promise<RecapDepannages> {
  if (siteIds.length === 0) return { enCours: [], traitees: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from("demandes_depannage")
    .select("id, numero, equipement_nom, message, statut, date_creation")
    .in("site_id", siteIds)
    .order("date_creation", { ascending: false });

  const enCours: LigneRecap[] = [];
  const traitees: LigneRecap[] = [];
  for (const d of data ?? []) {
    const ligne: LigneRecap = {
      id: d.id,
      numero: d.numero || "(sans numéro)",
      libelle: [d.equipement_nom, d.message].filter(Boolean).join(" — "),
      montant: null,
      href: `/depannages/${d.id}`,
    };
    if (d.statut === "traitee") traitees.push(ligne);
    else enCours.push(ligne);
  }

  return { enCours, traitees };
}

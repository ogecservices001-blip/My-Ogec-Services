import { createAdminClient } from "@/lib/supabase/admin";
import { Poles, labelPole } from "@/lib/bi/constants";
import { FAMILLES_CERFA, statutSoumission } from "@/lib/cerfa/regles";
import { STATUTS_BI_VALIDES } from "@/lib/facturation/ca-facturable";
import { NATURE_MULTIPLE } from "@/lib/devis/paves";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";

type Admin = ReturnType<typeof createAdminClient>;

/// « Mon contrat OGEC », phase 2 : parc, dépannages, documents, devis. Rien
/// d'interne : ni note, ni compte rendu, ni montant.

function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

const typeDuBon = (pole: string, polePrincipal: string | null | undefined) =>
  labelPole(pole === NATURE_MULTIPLE ? polePrincipal || pole : pole);

export type EvenementEquipement = { date: string; type: string; numero: string; biId: string };

/// Interventions validées du site, par équipement (BI sur l'équipement ou
/// visite d'entretien comptée pour lui), la plus récente d'abord.
export async function interventionsParEquipement(admin: Admin, siteId: string): Promise<Map<string, EvenementEquipement[]>> {
  const [{ data: bons }, { data: visites }] = await Promise.all([
    admin
      .from("bons_intervention")
      .select("id, numero, pole, pole_principal, date_intervention, date_fin, date_debut, equipement_id, interventions_supplementaires")
      .eq("site_id", siteId)
      .in("statut", STATUTS_BI_VALIDES),
    admin.from("visites_entretien").select("equipement_id, bon_intervention_id, date").eq("site_id", siteId),
  ]);
  const parBi = new Map((bons ?? []).map((b) => [b.id, b]));
  const resultat = new Map<string, EvenementEquipement[]>();
  const ajouter = (equipementId: string, e: EvenementEquipement) => {
    const liste = resultat.get(equipementId) ?? [];
    if (!liste.some((x) => x.biId === e.biId)) liste.push(e);
    resultat.set(equipementId, liste);
  };
  for (const b of bons ?? []) {
    const date = isoDepuisFr(b.date_fin || b.date_intervention || b.date_debut);
    if (b.equipement_id) ajouter(b.equipement_id, { date, type: typeDuBon(b.pole, b.pole_principal), numero: b.numero, biId: b.id });
    for (const p of (b.interventions_supplementaires as { equipement_id?: string | null; pole?: string }[] | null) ?? []) {
      if (p.equipement_id) ajouter(p.equipement_id, { date, type: labelPole(p.pole || b.pole), numero: b.numero, biId: b.id });
    }
  }
  for (const v of visites ?? []) {
    const b = parBi.get(v.bon_intervention_id);
    if (b) ajouter(v.equipement_id, { date: String(v.date).slice(0, 10), type: labelPole(b.pole), numero: b.numero, biId: b.id });
  }
  for (const liste of resultat.values()) liste.sort((a, b) => b.date.localeCompare(a.date));
  return resultat;
}

export type EquipementClient = {
  id: string;
  nom: string;
  groupe: string;
  localisation: string;
  famille: string;
  /// Dernier état connu : relevé d'entretien ou constat de dépannage.
  etat: { libelle: string; bon: boolean; date: string } | null;
  historique: EvenementEquipement[];
  /// Contrôle d'étanchéité, équipements soumis seulement : date du prochain
  /// contrôle (texte), "" si à programmer ; undefined si non concerné.
  prochainControle?: string;
};

export async function equipementsClient(admin: Admin, siteId: string): Promise<EquipementClient[]> {
  const [{ data: equipements }, { data: types }, { data: releves }, { data: depannages }, interventions] = await Promise.all([
    admin.from("equipements").select("id, nom, groupe, localisation, type_equipement_id, champs_en_tete").eq("site_id", siteId),
    admin.from("types_equipement").select("id, nom"),
    admin.from("releves").select("equipement_id, date, validation_fonctionnement").eq("site_id", siteId),
    admin
      .from("bons_intervention")
      .select("equipement_id, etat_equipement, interventions_supplementaires, date_intervention, date_fin")
      .eq("site_id", siteId)
      .eq("pole", Poles.depannage)
      .neq("statut", "brouillon"),
    interventionsParEquipement(admin, siteId),
  ]);
  const nomType = new Map((types ?? []).map((t) => [t.id, t.nom]));
  const etats = new Map<string, { libelle: string; bon: boolean; date: string }>();
  const proposer = (id: string, e: { libelle: string; bon: boolean; date: string }) => {
    const actuel = etats.get(id);
    if (!actuel || e.date >= actuel.date) etats.set(id, e);
  };
  for (const r of releves ?? []) {
    if (!r.validation_fonctionnement) continue;
    const bon = r.validation_fonctionnement !== "Non Fonctionnel";
    proposer(r.equipement_id, { libelle: bon ? "En fonctionnement" : "Hors fonctionnement", bon, date: String(r.date).slice(0, 10) });
  }
  for (const b of depannages ?? []) {
    const date = isoDepuisFr(b.date_fin || b.date_intervention);
    const pages = [
      { equipementId: b.equipement_id, etat: (b.etat_equipement as string[] | null) ?? [] },
      ...((b.interventions_supplementaires as { equipement_id?: string | null; etat_equipement?: string[] }[] | null) ?? []).map((p) => ({
        equipementId: p.equipement_id ?? null,
        etat: p.etat_equipement ?? [],
      })),
    ];
    for (const p of pages) {
      if (!p.equipementId) continue;
      const hs = p.etat.includes("hors_service");
      proposer(p.equipementId, { libelle: hs ? "Hors fonctionnement" : "En fonctionnement", bon: !hs, date });
    }
  }
  return (equipements ?? [])
    .map((e) => {
      const champs = (e.champs_en_tete ?? {}) as ChampsEnTeteEquipement;
      const soumis = FAMILLES_CERFA.includes(e.type_equipement_id) && statutSoumission(champs) === "soumis";
      const prochain = typeof champs.dateProchainControle === "string" ? champs.dateProchainControle.trim() : "";
      const ligne: EquipementClient = {
        id: e.id,
        nom: e.nom,
        groupe: e.groupe,
        localisation: e.localisation,
        famille: nomType.get(e.type_equipement_id) ?? "",
        etat: etats.get(e.id) ?? null,
        historique: interventions.get(e.id) ?? [],
      };
      if (soumis) ligne.prochainControle = prochain;
      return ligne;
    })
    .sort((a, b) => `${a.groupe} ${a.nom}`.localeCompare(`${b.groupe} ${b.nom}`, "fr", { numeric: true }));
}

export type DepannageClient = {
  id: string;
  numero: string;
  dateDemande: string;
  equipement: string;
  message: string;
  etat: "recue" | "planifiee" | "realisee";
  datePrevue: string;
  biId: string | null;
};

export async function depannagesClient(admin: Admin, siteId: string): Promise<DepannageClient[]> {
  const { data: demandes } = await admin
    .from("demandes_depannage")
    .select("id, numero, date_creation, equipement_nom, message, statut, date_intervention_prevue, intervenant_id, bon_intervention_id")
    .eq("site_id", siteId)
    .order("date_creation", { ascending: false })
    .limit(100);
  const idsBi = (demandes ?? []).map((d) => d.bon_intervention_id).filter((x): x is string => Boolean(x));
  const { data: bons } = idsBi.length
    ? await admin.from("bons_intervention").select("id, statut").in("id", idsBi)
    : { data: [] as { id: string; statut: string }[] };
  const biValides = new Set((bons ?? []).filter((b) => (STATUTS_BI_VALIDES as string[]).includes(b.statut)).map((b) => b.id));
  return (demandes ?? []).map((d) => ({
    id: d.id,
    numero: String(d.numero),
    dateDemande: String(d.date_creation).slice(0, 10),
    equipement: d.equipement_nom,
    message: d.message,
    etat: d.statut === "traitee" ? "realisee" : d.intervenant_id && d.date_intervention_prevue ? "planifiee" : "recue",
    datePrevue: d.date_intervention_prevue ?? "",
    biId: d.bon_intervention_id && biValides.has(d.bon_intervention_id) ? d.bon_intervention_id : null,
  }));
}

export type DocumentClient = { cle: string; date: string; titre: string; detail: string; href: string };

export async function documentsClient(admin: Admin, siteId: string): Promise<DocumentClient[]> {
  const [{ data: bons }, { data: cerfas }] = await Promise.all([
    admin
      .from("bons_intervention")
      .select("id, numero, pole, pole_principal, date_intervention, date_fin, date_debut, equipement_nom, visite_numero, visite_total")
      .eq("site_id", siteId)
      .in("statut", STATUTS_BI_VALIDES),
    admin.from("cerfas").select("id, numero, date_controle, equipement_nom, pdf_path").eq("site_id", siteId),
  ]);
  const docs: DocumentClient[] = [];
  for (const b of bons ?? []) {
    const date = isoDepuisFr(b.date_fin || b.date_intervention || b.date_debut);
    docs.push({
      cle: `bi-${b.id}`,
      date,
      titre: `Bon d'intervention ${b.numero}`,
      detail: [typeDuBon(b.pole, b.pole_principal), b.equipement_nom].filter(Boolean).join(" · "),
      href: `/mon-contrat/pdf/bi/${b.id}`,
    });
    if (b.pole === Poles.entretienSousContrat) {
      docs.push({
        cle: `rap-${b.id}`,
        date,
        titre: "Rapport de visite d'entretien",
        detail: b.visite_numero ? `Visite ${b.visite_numero}${b.visite_total ? ` de ${b.visite_total}` : ""} · ${b.numero}` : b.numero,
        href: `/mon-contrat/pdf/rapport/${b.id}`,
      });
    }
  }
  for (const c of cerfas ?? []) {
    if (!c.pdf_path) continue;
    docs.push({
      cle: `cerfa-${c.id}`,
      date: isoDepuisFr(c.date_controle),
      titre: "Contrôle d'étanchéité (CERFA 15497)",
      detail: [c.equipement_nom, c.numero].filter(Boolean).join(" · "),
      href: `/mon-contrat/pdf/cerfa/${c.id}`,
    });
  }
  return docs.sort((a, b) => b.date.localeCompare(a.date));
}

export type DevisClient = { id: string; date: string; objet: string; etat: string; attenteAccord: boolean };

/// Devis du site : objet et état seulement, jamais de montant.
export async function devisClient(admin: Admin, siteId: string): Promise<DevisClient[]> {
  const { data: devis } = await admin
    .from("devis")
    .select("id, numero, libelle, date_devis, date_commande_client, mois_facturation, annule, perdu_le, bi_reference_historique")
    .eq("site_id", siteId)
    .eq("annule", false)
    .neq("numero", "");
  const ids = (devis ?? []).map((d) => d.id);
  const { data: bons } = ids.length
    ? await admin.from("bons_intervention").select("devis_id, statut").in("devis_id", ids)
    : { data: [] as { devis_id: string | null; statut: string }[] };
  const realises = new Set((bons ?? []).filter((b) => b.devis_id && b.statut !== "brouillon").map((b) => b.devis_id as string));
  return (devis ?? [])
    .map((d) => {
      const realise = realises.has(d.id) || Boolean(d.bi_reference_historique) || Boolean(d.mois_facturation);
      const etat = realise
        ? "Travaux réalisés"
        : d.date_commande_client
          ? "Commandé — travaux à venir"
          : d.perdu_le
            ? "Non retenu"
            : "En attente de votre accord";
      return { id: d.id, date: isoDepuisFr(d.date_devis), objet: d.libelle || "Devis", etat, attenteAccord: etat === "En attente de votre accord" };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

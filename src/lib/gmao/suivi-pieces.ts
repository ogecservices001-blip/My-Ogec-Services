import type { SupabaseClient } from "@supabase/supabase-js";
import { Poles } from "@/lib/bi/constants";
import type { InterventionEquipement } from "@/lib/bi/format";
import type { PaveDevis } from "@/lib/devis/paves";

/// Suivi des pièces et travaux d'un équipement : signalement (BI « devis à
/// établir ») → devis → envoi → accord client → commande fournisseur →
/// remplacement (BI sur devis). Tout est déduit des données existantes.

export type EtapeSuivi = {
  code: "constat" | "devis" | "envoi" | "accord" | "commande" | "remplacement";
  libelle: string;
  fait: boolean;
  date: string;
  ref: string;
  lienBureau: string | null;
};

export type SujetSuivi = {
  cle: string;
  titre: string;
  etat: "en_cours" | "termine" | "annule";
  attenteAccordClient: boolean;
  montantHT: number | null;
  devisNumero: string;
  devisEnvoyeLe: string;
  etapes: EtapeSuivi[];
};

const STATUTS_BI_FAITS = new Set(["averif", "valide", "pdf", "prete", "envoye"]);

function equipementsDuDevis(d: { equipement_id: string | null; equipements_supplementaires: string[] | null; paves: unknown }): string[] {
  const paves = (d.paves as PaveDevis[] | null) ?? [];
  return [
    ...new Set([d.equipement_id, ...(d.equipements_supplementaires ?? []), ...paves.map((p) => p.equipementId)].filter((x): x is string => Boolean(x))),
  ];
}

type EntreeBi = { equipement_id: string | null; compte_rendu: string; etat_equipement: string[] };
function entreesBi(b: { equipement_id: string | null; compte_rendu: string; etat_equipement: unknown; interventions_supplementaires: unknown }): EntreeBi[] {
  return [
    { equipement_id: b.equipement_id, compte_rendu: b.compte_rendu, etat_equipement: (b.etat_equipement as string[] | null) ?? [] },
    ...((b.interventions_supplementaires as InterventionEquipement[] | null) ?? []).map((i) => ({
      equipement_id: i.equipement_id,
      compte_rendu: i.compte_rendu,
      etat_equipement: i.etat_equipement ?? [],
    })),
  ];
}

const court = (t: string, n = 70) => {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/// Sujets de suivi par équipement, pour les équipements donnés (même site ou non).
export async function chargerSuiviPieces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  equipementIds: string[],
): Promise<Map<string, SujetSuivi[]>> {
  const resultat = new Map<string, SujetSuivi[]>();
  if (equipementIds.length === 0) return resultat;
  const ids = new Set(equipementIds);
  const { data: eqs } = await supabase.from("equipements").select("id, site_id").in("id", equipementIds);
  const siteIds = [...new Set((eqs ?? []).map((e) => e.site_id))];
  if (siteIds.length === 0) return resultat;

  const [{ data: devisSites }, { data: bonsDepannage }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, numero, libelle, date_devis, envoyee_le, date_commande_client, annule, montant, signalement_bi, equipement_id, equipements_supplementaires, paves")
      .in("site_id", siteIds),
    supabase
      .from("bons_intervention")
      .select("id, numero, date_intervention, date_debut, compte_rendu, equipement_id, etat_equipement, interventions_supplementaires")
      .in("site_id", siteIds)
      .eq("pole", Poles.depannage)
      .neq("statut", "brouillon"),
  ]);
  const devis = (devisSites ?? []).filter((d) => equipementsDuDevis(d).some((id) => ids.has(id)));
  const devisIds = devis.map((d) => d.id);
  const [{ data: commandes }, { data: bonsDevis }] = devisIds.length
    ? await Promise.all([
        supabase.from("commandes_fournisseur").select("id, numero, devis_id, date_commande, livre").in("devis_id", devisIds),
        supabase.from("bons_intervention").select("id, numero, statut, devis_id, date_intervention, date_fin, date_debut").in("devis_id", devisIds),
      ])
    : [{ data: [] }, { data: [] }];

  const biParNumero = new Map((bonsDepannage ?? []).map((b) => [b.numero, b]));
  const signalementsTraites = new Set(devis.filter((d) => !d.annule).map((d) => (d.signalement_bi ?? "").split("|")[0]).filter(Boolean));
  const ajouter = (equipementId: string, s: SujetSuivi) => resultat.set(equipementId, [...(resultat.get(equipementId) ?? []), s]);

  for (const d of devis) {
    const signalement = biParNumero.get((d.signalement_bi ?? "").split("|")[0]);
    const commande = (commandes ?? []).find((c) => c.devis_id === d.id);
    const remplacement = (bonsDevis ?? []).find((b) => b.devis_id === d.id && STATUTS_BI_FAITS.has(b.statut));
    const paves = (d.paves as PaveDevis[] | null) ?? [];
    for (const equipementId of equipementsDuDevis(d).filter((id) => ids.has(id))) {
      const pave = paves.find((p) => p.equipementId === equipementId);
      const etapes: EtapeSuivi[] = [];
      if (signalement) {
        etapes.push({
          code: "constat",
          libelle: "Signalé",
          fait: true,
          date: signalement.date_intervention || signalement.date_debut,
          ref: signalement.numero,
          lienBureau: `/bi/${signalement.id}`,
        });
      }
      etapes.push({ code: "devis", libelle: "Devis", fait: true, date: d.date_devis, ref: d.numero, lienBureau: `/devis/${d.id}/statut` });
      etapes.push({
        code: "envoi",
        libelle: "Envoyé au client",
        fait: Boolean(d.envoyee_le || d.date_commande_client),
        date: d.envoyee_le ?? "",
        ref: "",
        lienBureau: null,
      });
      etapes.push({ code: "accord", libelle: "Accord client", fait: Boolean(d.date_commande_client), date: d.date_commande_client ?? "", ref: "", lienBureau: null });
      etapes.push({
        code: "commande",
        libelle: commande?.livre ? "Pièce livrée" : "Pièce commandée",
        fait: Boolean(commande),
        date: commande?.date_commande ?? "",
        ref: commande?.numero ?? "",
        lienBureau: commande ? `/commandes-fournisseur/${commande.id}` : null,
      });
      etapes.push({
        code: "remplacement",
        libelle: "Remplacé",
        fait: Boolean(remplacement),
        date: remplacement ? remplacement.date_fin || remplacement.date_intervention || remplacement.date_debut : "",
        ref: remplacement?.numero ?? "",
        lienBureau: remplacement ? `/bi/${remplacement.id}` : null,
      });
      ajouter(equipementId, {
        cle: `devis-${d.id}-${equipementId}`,
        titre: court(pave?.libelle || d.libelle || "Travaux"),
        etat: d.annule ? "annule" : remplacement ? "termine" : "en_cours",
        attenteAccordClient: !d.annule && Boolean(d.envoyee_le) && !d.date_commande_client,
        montantHT: d.montant ?? null,
        devisNumero: d.numero,
        devisEnvoyeLe: d.envoyee_le ?? "",
        etapes,
      });
    }
  }

  for (const b of bonsDepannage ?? []) {
    if (signalementsTraites.has(b.numero)) continue;
    for (const e of entreesBi(b)) {
      if (!e.equipement_id || !ids.has(e.equipement_id) || !e.etat_equipement.includes("devis_a_etablir")) continue;
      ajouter(e.equipement_id, {
        cle: `signal-${b.id}-${e.equipement_id}`,
        titre: court(e.compte_rendu || "Pièce à remplacer"),
        etat: "en_cours",
        attenteAccordClient: false,
        montantHT: null,
        devisNumero: "",
        devisEnvoyeLe: "",
        etapes: [
          { code: "constat", libelle: "Signalé", fait: true, date: b.date_intervention || b.date_debut, ref: b.numero, lienBureau: `/bi/${b.id}` },
          { code: "devis", libelle: "Devis à établir", fait: false, date: "", ref: "", lienBureau: null },
          { code: "envoi", libelle: "Envoyé au client", fait: false, date: "", ref: "", lienBureau: null },
          { code: "accord", libelle: "Accord client", fait: false, date: "", ref: "", lienBureau: null },
          { code: "commande", libelle: "Pièce commandée", fait: false, date: "", ref: "", lienBureau: null },
          { code: "remplacement", libelle: "Remplacé", fait: false, date: "", ref: "", lienBureau: null },
        ],
      });
    }
  }

  const ordre = { en_cours: 0, termine: 1, annule: 2 } as const;
  for (const [k, liste] of resultat) resultat.set(k, liste.sort((a, b) => ordre[a.etat] - ordre[b.etat]));
  return resultat;
}

export function nombreEnCours(sujets: SujetSuivi[] | undefined): number {
  return (sujets ?? []).filter((s) => s.etat === "en_cours").length;
}

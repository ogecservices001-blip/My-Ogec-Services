import type { createAdminClient } from "@/lib/supabase/admin";
import { Statuts, labelPole } from "@/lib/bi/constants";
import { NATURE_MULTIPLE } from "@/lib/devis/paves";
import type { ChampEnTete, ChampsEnTeteEquipement } from "@/lib/gmao/types";

type AdminClient = ReturnType<typeof createAdminClient>;

function normaliserEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export type EquipementPublicDonnees = {
  equipement: {
    id: string;
    nom: string;
    groupe: string;
    numero_equipement: string;
    localisation: string;
    /// Uniquement les champs affichés au client (ceux de la famille).
    champs_en_tete: ChampsEnTeteEquipement;
  };
  /// Interventions validées sur l'équipement, sans aucune note interne.
  historique: { date: string; type: string; numero: string }[];
  site: {
    id: string;
    nom: string;
    site: string;
    adresse: string;
    commune: string;
  };
  type: { code: string; nom: string; champs_en_tete_supplementaires: ChampEnTete[] } | null;
};

export type ResultatChargement =
  | { ok: true; donnees: EquipementPublicDonnees }
  | { ok: false; erreur: string };

/// Charge l'équipement (par son code_qr public), son site et sa famille
/// — port de `chargerEquipementEtClient` (functions/index.js).
export async function chargerEquipementEtSite(admin: AdminClient, codeQr: string): Promise<ResultatChargement> {
  const { data: eq, error: errEq } = await admin.from("equipements").select("*").eq("code_qr", codeQr).single();
  if (errEq || !eq) return { ok: false, erreur: "Équipement introuvable." };

  const { data: site, error: errSite } = await admin.from("sites").select("*").eq("id", eq.site_id).single();
  if (errSite || !site) return { ok: false, erreur: "Site introuvable." };

  let type: EquipementPublicDonnees["type"] = null;
  if (eq.type_equipement_id) {
    const { data: t } = await admin
      .from("types_equipement")
      .select("code, nom, champs_en_tete_supplementaires")
      .eq("id", eq.type_equipement_id)
      .single();
    if (t) {
      type = {
        code: t.code,
        nom: t.nom,
        champs_en_tete_supplementaires: (t.champs_en_tete_supplementaires ?? []) as ChampEnTete[],
      };
    }
  }

  const champsTous = (eq.champs_en_tete ?? {}) as ChampsEnTeteEquipement;
  const clesAffichees = new Set((type?.champs_en_tete_supplementaires ?? []).map((c) => c.cle));
  const champsAffiches = Object.fromEntries(Object.entries(champsTous).filter(([cle]) => clesAffichees.has(cle)));

  return {
    ok: true,
    donnees: {
      equipement: {
        id: eq.id,
        nom: eq.nom,
        groupe: eq.groupe,
        numero_equipement: eq.numero_equipement,
        localisation: eq.localisation,
        champs_en_tete: champsAffiches as ChampsEnTeteEquipement,
      },
      historique: await chargerHistoriquePublic(admin, eq.id, eq.site_id),
      site: {
        id: site.id,
        nom: site.nom,
        site: site.site,
        adresse: site.adresse,
        commune: site.commune,
      },
      type,
    },
  };
}

const STATUTS_BI_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/// Historique montré au client sur la page QR : date, type et n° des BI
/// validés qui concernent l'équipement (BI sur l'équipement, ou visite
/// d'entretien comptée pour lui). Aucune note, aucun compte rendu.
async function chargerHistoriquePublic(admin: AdminClient, equipementId: string, siteId: string | null) {
  if (!siteId) return [];
  const [{ data: bons }, { data: visites }] = await Promise.all([
    admin
      .from("bons_intervention")
      .select("id, numero, pole, pole_principal, date_intervention, date_fin, date_debut, equipement_id, interventions_supplementaires")
      .eq("site_id", siteId)
      .in("statut", STATUTS_BI_VALIDES),
    admin.from("visites_entretien").select("bon_intervention_id, date").eq("equipement_id", equipementId),
  ]);
  const dateVisite = new Map((visites ?? []).map((v) => [v.bon_intervention_id, String(v.date).slice(0, 10)]));
  const lignes: { date: string; type: string; numero: string }[] = [];
  for (const b of bons ?? []) {
    const pages = (b.interventions_supplementaires as { equipement_id?: string | null; pole?: string }[] | null) ?? [];
    const pageEquipement = pages.find((p) => p.equipement_id === equipementId);
    const concerne = b.equipement_id === equipementId || Boolean(pageEquipement) || dateVisite.has(b.id);
    if (!concerne) continue;
    const pole = b.pole === NATURE_MULTIPLE ? (pageEquipement?.pole || b.pole_principal || b.pole) : b.pole;
    lignes.push({
      date: dateVisite.get(b.id) || isoDepuisFr(b.date_intervention || b.date_fin || b.date_debut),
      type: labelPole(pole),
      numero: b.numero,
    });
  }
  return lignes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
}

/// Un email est "connu" s'il correspond à l'un des contacts déjà
/// enregistrés sur la fiche du site (interlocuteurs 1 à 4, tiers,
/// responsable contrat, facturation) OU à n'importe quelle personne ayant
/// déjà accès à l'appli (email personnel ou email de connexion). Les
/// adresses sont lues ici, en base : elles ne partent jamais vers la page
/// publique. Port de `emailConnu` (functions/index.js).
export async function emailConnuDuSite(
  admin: AdminClient,
  site: EquipementPublicDonnees["site"],
  email: string,
): Promise<boolean> {
  const emailNormalise = normaliserEmail(email);
  if (!emailNormalise) return false;

  const { data: contacts } = await admin
    .from("sites")
    .select(
      "courriel_interlocuteur_site, courriel_interlocuteur_site_2, courriel_interlocuteur_site_3, courriel_interlocuteur_site_4, courriel_tiers, courriel_responsable, courriel_interlocuteur_facturation",
    )
    .eq("id", site.id)
    .single();
  const connusSite = [
    contacts?.courriel_interlocuteur_site,
    contacts?.courriel_interlocuteur_site_2,
    contacts?.courriel_interlocuteur_site_3,
    contacts?.courriel_interlocuteur_site_4,
    contacts?.courriel_tiers,
    contacts?.courriel_responsable,
    contacts?.courriel_interlocuteur_facturation,
  ]
    .flatMap((v) => (v ?? "").split(/[;,\s]+/))
    .map(normaliserEmail)
    .filter(Boolean);
  if (connusSite.includes(emailNormalise)) return true;

  const { data: profils } = await admin.from("profiles").select("email_perso");
  const connusPerso = (profils ?? []).map((p) => normaliserEmail(p.email_perso)).filter(Boolean);
  if (connusPerso.includes(emailNormalise)) return true;

  const { data: usersData } = await admin.auth.admin.listUsers();
  const connusAuth = (usersData?.users ?? []).map((u) => normaliserEmail(u.email)).filter(Boolean);
  return connusAuth.includes(emailNormalise);
}

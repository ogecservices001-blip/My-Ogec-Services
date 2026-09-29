import type { createAdminClient } from "@/lib/supabase/admin";
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
    remarque_technicien: string;
    champs_en_tete: ChampsEnTeteEquipement;
  };
  site: {
    id: string;
    nom: string;
    site: string;
    adresse: string;
    commune: string;
    courriel_interlocuteur_site: string;
    courriel_tiers: string;
    courriel_responsable: string;
    courriel_interlocuteur_facturation: string;
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

  return {
    ok: true,
    donnees: {
      equipement: {
        id: eq.id,
        nom: eq.nom,
        groupe: eq.groupe,
        numero_equipement: eq.numero_equipement,
        localisation: eq.localisation,
        remarque_technicien: eq.remarque_technicien,
        champs_en_tete: eq.champs_en_tete as ChampsEnTeteEquipement,
      },
      site: {
        id: site.id,
        nom: site.nom,
        site: site.site,
        adresse: site.adresse,
        commune: site.commune,
        courriel_interlocuteur_site: site.courriel_interlocuteur_site,
        courriel_tiers: site.courriel_tiers,
        courriel_responsable: site.courriel_responsable,
        courriel_interlocuteur_facturation: site.courriel_interlocuteur_facturation,
      },
      type,
    },
  };
}

/// Un email est "connu" s'il correspond à l'un des contacts déjà
/// enregistrés sur la fiche du site (site, tiers, responsable contrat,
/// facturation) OU à n'importe quelle personne ayant déjà accès à
/// l'appli (email personnel ou email de connexion). Port de
/// `emailConnu` (functions/index.js).
export async function emailConnuDuSite(
  admin: AdminClient,
  site: EquipementPublicDonnees["site"],
  email: string,
): Promise<boolean> {
  const emailNormalise = normaliserEmail(email);
  if (!emailNormalise) return false;

  const connusSite = [
    site.courriel_interlocuteur_site,
    site.courriel_tiers,
    site.courriel_responsable,
    site.courriel_interlocuteur_facturation,
  ]
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

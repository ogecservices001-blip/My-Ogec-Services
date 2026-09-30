"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { Poles, Statuts, CHAMPS_MATERIEL_EXCLUS_BI } from "@/lib/bi/constants";
import { now } from "@/lib/bi/format";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/types";

export type CorrectionInput = {
  pole: string;
  techniciens: string[];
  date_debut: string;
  date_fin: string;
  date_intervention: string;
  temps_passe: string;
  compte_rendu: string;
  obs_tech: string;
  note_interne: string;
  email: string;
};

type Bon = Tables<"bons_intervention">;

function diff(changes: { champ: string; avant: string; apres: string }[], label: string, avant: string, apres: string) {
  if (avant !== apres) changes.push({ champ: label, avant, apres });
}

/// Automatisation GMAO déclenchée par la validation bureau d'un bon,
/// selon le pôle — ne doit jamais bloquer la validation du bon
/// elle-même si elle échoue (voir l'appel dans validerBI, encadré d'un
/// try/catch silencieux).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executerAutomatisationGmao(supabase: any, bi: Bon) {
  const date = now();
  switch (bi.pole) {
    case Poles.reparationEquipement:
    case Poles.entretienHorsContrat: {
      if (!bi.equipement_id) return;
      const verbe = bi.pole === Poles.reparationEquipement ? "Réparé" : "Entretien effectué";
      await ajouterRemarqueEquipement(supabase, bi.equipement_id, `${verbe} le ${date} via ${bi.numero} : ${bi.compte_rendu}`);
      break;
    }
    case Poles.entretienSousContrat: {
      if (bi.entretien_groupes.length === 0) return;
      const { data: equipementsSite } = await supabase
        .from("equipements")
        .select("id, nom, groupe")
        .eq("site_id", bi.site_id);
      const nomsNonDesservis = new Set(
        (bi.entretien_non_desservis as { nom?: string }[]).map((e) => e.nom).filter(Boolean),
      );
      for (const eq of equipementsSite ?? []) {
        if (!bi.entretien_groupes.includes(eq.groupe) || nomsNonDesservis.has(eq.nom)) continue;
        await ajouterRemarqueEquipement(supabase, eq.id, `Entretien effectué le ${date} via ${bi.numero} : ${bi.compte_rendu}`);
      }
      break;
    }
    case Poles.remplacementIdentique: {
      if (!bi.equipement_id) return;
      await ajouterRemarqueEquipement(supabase, bi.equipement_id, `Remplacé le ${date} via ${bi.numero} : ${bi.compte_rendu}`);
      const champs = bi.materiel_champs_en_tete as Record<string, string>;
      const donnees = Object.fromEntries(
        Object.entries(champs).filter(([cle, v]) => !CHAMPS_MATERIEL_EXCLUS_BI.has(cle) && v && String(v).trim()),
      );
      if (Object.keys(donnees).length > 0) {
        const { data: eq } = await supabase.from("equipements").select("champs_en_tete").eq("id", bi.equipement_id).single();
        await supabase
          .from("equipements")
          .update({ champs_en_tete: { ...(eq?.champs_en_tete ?? {}), ...donnees } })
          .eq("id", bi.equipement_id);
      }
      break;
    }
    case Poles.installationNeuve: {
      if (!bi.equipement_nom.trim() || !bi.materiel_type_equipement_id) return;
      const champs = bi.materiel_champs_en_tete as Record<string, string>;
      const champsEnTete = Object.fromEntries(
        Object.entries(champs).filter(([cle, v]) => !CHAMPS_MATERIEL_EXCLUS_BI.has(cle) && v && String(v).trim()),
      );
      await supabase.from("equipements").insert({
        site_id: bi.site_id,
        type_equipement_id: bi.materiel_type_equipement_id,
        nom: bi.equipement_nom,
        localisation: bi.equipement_localisation,
        groupe: bi.equipement_groupe,
        hors_contrat: bi.hors_contrat,
        champs_en_tete: champsEnTete,
        remarque_technicien: `Installé le ${date} via ${bi.numero} : ${bi.compte_rendu} — Hors contrat d'entretien.`,
      });
      break;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ajouterRemarqueEquipement(supabase: any, equipementId: string, remarque: string) {
  const { data: eq } = await supabase.from("equipements").select("remarque_technicien").eq("id", equipementId).single();
  const existante = eq?.remarque_technicien ?? "";
  const nouvelle = existante ? `${existante}\n${remarque}` : remarque;
  await supabase.from("equipements").update({ remarque_technicien: nouvelle }).eq("id", equipementId);
}

export async function validerBI(id: string, original: Bon, input: CorrectionInput): Promise<ActionResult> {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const changes: { champ: string; avant: string; apres: string }[] = [];
  diff(changes, "Pôle", original.pole, input.pole);
  diff(changes, "Techniciens", original.techniciens.join(", "), input.techniciens.join(", "));
  diff(changes, "Date de début", original.date_debut, input.date_debut);
  diff(changes, "Date de fin", original.date_fin, input.date_fin);
  diff(changes, "Date d'intervention", original.date_intervention, input.date_intervention);
  diff(changes, "Temps passé", original.temps_passe, input.temps_passe);
  diff(changes, "Compte rendu", original.compte_rendu, input.compte_rendu);
  diff(changes, "Email client", original.email, input.email);
  diff(changes, "Remarque interne", original.note_interne, input.note_interne);

  const history = Array.isArray(original.history) ? original.history : [];
  const nouvelHistory =
    changes.length > 0 ? [...history, { user: profile.name, date: now(), changes }] : history;

  const { data: corrige, error } = await supabase
    .from("bons_intervention")
    .update({
      pole: input.pole,
      statut: Statuts.valide,
      techniciens: input.techniciens,
      date_debut: input.date_debut,
      date_fin: input.date_fin,
      date_intervention: input.date_intervention,
      temps_passe: input.temps_passe,
      compte_rendu: input.compte_rendu,
      obs_tech: input.obs_tech,
      note_interne: input.note_interne,
      email: input.email,
      history: nouvelHistory,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !corrige) return { ok: false, erreur: error?.message ?? "Échec de la validation." };

  try {
    await executerAutomatisationGmao(supabase, corrige as Bon);
  } catch {
    // L'automatisation GMAO ne doit jamais empêcher la validation du
    // bon lui-même — une erreur ici reste silencieuse pour l'usager.
  }

  revalidatePath("/bi");
  revalidatePath(`/bi/${id}`);
  return { ok: true };
}

export async function urlPhotoSignee(chemin: string): Promise<string | null> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("bi-photos").createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

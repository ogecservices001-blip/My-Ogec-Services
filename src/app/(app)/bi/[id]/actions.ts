"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { Poles, Statuts, CHAMPS_MATERIEL_EXCLUS_BI, POLE_PLUSIEURS_TYPES } from "@/lib/bi/constants";
import { now, interventionsDuBon, type Presta, type InterventionEquipement } from "@/lib/bi/format";
import { archiverBiSiBesoin, genererPdfAvecPhotos } from "@/lib/bi/archive";
import { envoyerConfirmationBI, envoyerRapportVisiteEmail } from "@/lib/bi/email";
import { chargerRapportVisite, genererPdfRapportVisite, nomFichierRapport } from "@/lib/gmao/rapport-visite";
import { analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import {
  controlerVisite,
  dateVisiteDuBon,
  equipementsEntretenus,
  libelleVisite,
  visitesDejaValidees,
  type VisiteSaisie,
} from "@/lib/gmao/visites";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/types";

export type CorrectionInput = {
  pole: string;
  techniciens: string[];
  date_debut: string;
  date_fin: string;
  date_intervention: string;
  temps_passe: string;
  nombre_deplacements: number;
  compte_rendu: string;
  obs_tech: string;
  note_interne: string;
  email: string;
  prestas: Presta[];
  etat_equipement: string[];
  interventions_supplementaires: InterventionEquipement[];
  equipement_nom: string;
  equipement_numero: string;
  mois_facturation: string;
  /// BI Entretien sous contrat : n° de visite et année du contrat saisis par le bureau.
  visite?: VisiteSaisie | null;
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
  // BI à plusieurs pages : chaque page est traitée comme un bon de son type.
  if (bi.pole === POLE_PLUSIEURS_TYPES) {
    for (const page of interventionsDuBon(bi)) {
      await executerAutomatisationGmao(supabase, {
        ...bi,
        pole: page.pole ?? "",
        pole_principal: "",
        equipement_id: page.equipement_id,
        equipement_nom: page.equipement_nom,
        equipement_groupe: page.equipement_groupe,
        equipement_localisation: page.equipement_localisation,
        equipement_numero: page.equipement_numero ?? "",
        compte_rendu: page.compte_rendu,
        materiel_type_equipement_id: page.materiel_type_equipement_id ?? null,
        materiel_champs_en_tete: page.materiel_champs_en_tete ?? {},
        interventions_supplementaires: [],
      });
    }
    return;
  }
  const date = now();
  switch (bi.pole) {
    case Poles.reparationEquipement:
    case Poles.entretienHorsContrat: {
      const verbe = bi.pole === Poles.reparationEquipement ? "Réparé" : "Entretien effectué";
      for (const inter of interventionsDuBon(bi)) {
        if (!inter.equipement_id) continue;
        await ajouterRemarqueEquipement(supabase, inter.equipement_id, `${verbe} le ${date} via ${bi.numero} : ${inter.compte_rendu}`);
      }
      break;
    }
    case Poles.entretienSousContrat: {
      // BI de rattrapage : les équipements ayant déjà eu cette visite par un
      // autre BI ne sont ni recomptés ni re-annotés.
      const tous = await equipementsEntretenus(supabase, bi);
      const deja = await visitesDejaValidees(supabase, tous.map((e) => e.id), bi.visite_numero, bi.visite_annee, bi.id);
      const entretenus = tous.filter((e) => !deja.has(e.id));
      for (const eq of entretenus) {
        await ajouterRemarqueEquipement(supabase, eq.id, `Entretien effectué le ${date} via ${bi.numero} : ${bi.compte_rendu}`);
      }
      if (entretenus.length === 0 || !bi.visite_numero || !bi.visite_total || !bi.visite_annee) break;
      const repere = { visite_numero: bi.visite_numero, visite_total: bi.visite_total };
      await supabase.from("visites_entretien").upsert(
        entretenus.map((eq) => ({
          equipement_id: eq.id,
          site_id: bi.site_id,
          bon_intervention_id: bi.id,
          date: dateVisiteDuBon(bi),
          annee: bi.visite_annee,
          ...repere,
        })),
        { onConflict: "bon_intervention_id,equipement_id" },
      );
      await rattacherReleves(supabase, bi, entretenus.map((eq) => eq.id));
      break;
    }
    case Poles.remplacementIdentique: {
      for (const [i, inter] of interventionsDuBon(bi).entries()) {
        if (!inter.equipement_id) continue;
        await ajouterRemarqueEquipement(supabase, inter.equipement_id, `Remplacé le ${date} via ${bi.numero} : ${inter.compte_rendu}`);
        const champs = (i === 0 ? bi.materiel_champs_en_tete : inter.materiel_champs_en_tete) as Record<string, string> | undefined;
        const donnees = Object.fromEntries(
          Object.entries(champs ?? {}).filter(([cle, v]) => !CHAMPS_MATERIEL_EXCLUS_BI.has(cle) && v && String(v).trim()),
        );
        if (Object.keys(donnees).length > 0) {
          const { data: eq } = await supabase.from("equipements").select("champs_en_tete").eq("id", inter.equipement_id).single();
          await supabase
            .from("equipements")
            .update({ champs_en_tete: { ...(eq?.champs_en_tete ?? {}), ...donnees } })
            .eq("id", inter.equipement_id);
        }
      }
      break;
    }
    case Poles.installationNeuve: {
      const poses = [
        {
          nom: bi.equipement_nom,
          numero: bi.equipement_numero,
          localisation: bi.equipement_localisation,
          groupe: bi.equipement_groupe,
          compteRendu: bi.compte_rendu,
          typeId: bi.materiel_type_equipement_id,
          champs: bi.materiel_champs_en_tete as Record<string, string>,
        },
        ...((bi.interventions_supplementaires as InterventionEquipement[] | null) ?? []).map((inter) => ({
          nom: inter.equipement_nom,
          numero: inter.equipement_numero ?? "",
          localisation: inter.equipement_localisation,
          groupe: inter.equipement_groupe,
          compteRendu: inter.compte_rendu,
          typeId: inter.materiel_type_equipement_id ?? null,
          champs: inter.materiel_champs_en_tete ?? {},
        })),
      ];
      for (const pose of poses) {
        if (!pose.nom.trim() || !pose.typeId) continue;
        const champs = pose.champs;
        const champsEnTete = Object.fromEntries(
          Object.entries(champs).filter(([cle, v]) => !CHAMPS_MATERIEL_EXCLUS_BI.has(cle) && v && String(v).trim()),
        );
        // Même logique que creerEquipement (formulaire GMAO) : Type
        // Equipement 1 vient toujours de la famille (jamais saisi), et la
        // référence horaire matchée est stockée pour que les heures de
        // maintenance du parc s'affichent sans ressaisie.
        const { data: type } = await supabase
          .from("types_equipement")
          .select("type_equipement1_fixe")
          .eq("id", pose.typeId)
          .single();
        if (type?.type_equipement1_fixe) {
          champsEnTete.typeEquipement1 = type.type_equipement1_fixe;
        }
        // Fréquence d'entretien jamais saisie en BI (voir
        // CHAMPS_MATERIEL_EXCLUS_BI) : le contrat fixe une fréquence
        // uniforme pour tout le site, on reprend donc celle déjà en
        // vigueur sur les autres équipements du site plutôt que de
        // laisser le nouvel équipement sans heures prévues.
        const { data: equipementsSite } = await supabase
          .from("equipements")
          .select("champs_en_tete")
          .eq("site_id", bi.site_id);
        const comptesFreq = new Map<string, number>();
        for (const eq of equipementsSite ?? []) {
          const f = eq.champs_en_tete?.freqEntretienAnnuelle;
          if (typeof f === "string" && f.trim()) comptesFreq.set(f, (comptesFreq.get(f) ?? 0) + 1);
        }
        const freqSite = [...comptesFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (freqSite) champsEnTete.freqEntretienAnnuelle = freqSite;

        const { data: references } = await supabase.from("references_horaires").select("*");
        const { reference } = analyserReference(champsEnTete, references ?? []);
        await supabase.from("equipements").insert({
          site_id: bi.site_id,
          type_equipement_id: pose.typeId,
          nom: pose.nom,
          numero_equipement: pose.numero,
          localisation: pose.localisation,
          groupe: pose.groupe,
          // Toujours hors contrat à la création, même chez un client sous
          // contrat : un équipement ajouté n'est jamais automatiquement
          // couvert par le contrat existant, il faut un avenant. Chez un
          // client déjà hors contrat, c'est trivial — rien à signaler.
          hors_contrat: true,
          champs_en_tete: champsEnTete,
          reference_horaire_id: reference?.id ?? null,
          remarque_technicien: `Installé le ${date} via ${bi.numero} : ${pose.compteRendu}${bi.hors_contrat ? "" : " — Hors contrat, avenant à faire."}`,
        });
      }
      break;
    }
  }
}

/// Les relevés techniques pas encore rattachés de ces équipements prennent le
/// repère de la visite du BI. Renvoie le nombre de relevés rattachés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rattacherReleves(supabase: any, bi: Bon, equipementIds: string[]): Promise<number> {
  if (equipementIds.length === 0 || !bi.visite_numero) return 0;
  const { data, error } = await supabase
    .from("releves")
    .update({
      bon_intervention_id: bi.id,
      visite_numero: bi.visite_numero,
      visite_total: bi.visite_total,
      visite_annee: bi.visite_annee,
    })
    .in("equipement_id", equipementIds)
    .is("bon_intervention_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/// Bouton du BI validé : rattache les relevés saisis après la validation.
export async function rattacherRelevesEnAttente(id: string): Promise<ActionResult & { nombre?: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: bi } = await supabase.from("bons_intervention").select("*").eq("id", id).single();
  if (!bi) return { ok: false, erreur: "BI introuvable." };
  if (bi.pole !== Poles.entretienSousContrat || !bi.visite_numero) {
    return { ok: false, erreur: "Ce BI n'est pas une visite d'entretien validée." };
  }
  try {
    const entretenus = await equipementsEntretenus(supabase, bi);
    const nombre = await rattacherReleves(supabase, bi, entretenus.map((e) => e.id));
    revalidatePath(`/bi/${id}`);
    revalidatePath("/gmao", "layout");
    return { ok: true, nombre };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Rattachement impossible." };
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
  if (input.mois_facturation && !FORMAT_MOIS_ANNEE.test(input.mois_facturation)) {
    return { ok: false, erreur: "Mois de facturation : format attendu MM-AAAA (ex : 10-2026)." };
  }
  const supabase = await createClient();

  const visite = input.pole === Poles.entretienSousContrat ? input.visite : null;
  if (input.pole === Poles.entretienSousContrat) {
    const erreurVisite = controlerVisite(visite);
    if (erreurVisite) return { ok: false, erreur: erreurVisite };
  }

  const entretienSousContrat = input.pole === Poles.entretienSousContrat;
  const { data: classementEnBase } = await supabase.from("bons_intervention").select("classement").eq("id", id).single();
  if (!entretienSousContrat && classementEnBase?.classement === "facturer" && !input.mois_facturation) {
    return { ok: false, erreur: "Le mois de facturation est obligatoire pour un BI à facturer." };
  }

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
  diff(changes, "Nom de l'équipement", original.equipement_nom, input.equipement_nom);
  diff(changes, "Numéro d'équipement", original.equipement_numero, input.equipement_numero);
  diff(changes, "Mois de facturation", original.mois_facturation, input.mois_facturation);

  const history = Array.isArray(original.history) ? original.history : [];
  const nouvelHistory =
    changes.length > 0 ? [...history, { user: profile.name, date: now(), changes }] : history;

  const { data: corrige, error } = await supabase
    .from("bons_intervention")
    .update({
      pole: input.pole,
      statut: Statuts.valide,
      visite_numero: visite?.numero ?? null,
      visite_total: visite?.total ?? null,
      visite_annee: visite?.annee ?? null,
      techniciens: input.techniciens,
      date_debut: input.date_debut,
      date_fin: input.date_fin,
      date_intervention: input.date_intervention,
      temps_passe: input.temps_passe,
      nombre_deplacements: input.nombre_deplacements,
      compte_rendu: input.compte_rendu,
      obs_tech: input.obs_tech,
      note_interne: input.note_interne,
      email: input.email,
      prestas: input.prestas,
      etat_equipement: input.etat_equipement,
      equipement_nom: input.equipement_nom,
      equipement_numero: input.equipement_numero,
      interventions_supplementaires: input.interventions_supplementaires,
      mois_facturation: entretienSousContrat ? "" : input.mois_facturation,
      ...(entretienSousContrat ? { classement: "maintenance" } : {}),
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

  try {
    await archiverBiSiBesoin(supabase, corrige as Bon);
  } catch {
    // Idem : l'archivage ne doit jamais bloquer la validation — "Voir
    // PDF" reste un filet de sécurité si ça échoue ici.
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

export async function urlArchiveSignee(chemin: string): Promise<string | null> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("bi-archives").createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

/// Envoie le PDF au client par email — action manuelle depuis l'écran
/// bureau (même schéma que "Répondre par email" côté Suivi Dépannage),
/// jamais automatique à la validation.
/// Envoie au client le rapport technique de la visite d'entretien.
export async function envoyerRapportParEmail(id: string, informationComplementaire: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const chargement = await chargerRapportVisite(supabase, id);
  if (!chargement.ok) return { ok: false, erreur: chargement.erreur };
  const { bi } = chargement.donnees;
  if (!bi.email) return { ok: false, erreur: "Aucun email client sur ce bon." };
  try {
    const pdfBytes = await genererPdfRapportVisite(chargement.donnees);
    await envoyerRapportVisiteEmail({
      bon: bi,
      visite: libelleVisite({ numero: bi.visite_numero, total: bi.visite_total, annee: bi.visite_annee }),
      pdfBytes,
      nomFichier: nomFichierRapport(bi),
      informationComplementaire,
    });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi." };
  }
  return { ok: true };
}

export async function envoyerBiParEmail(id: string, informationComplementaire: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: bon, error } = await supabase.from("bons_intervention").select("*").eq("id", id).single();
  if (error || !bon) return { ok: false, erreur: "Bon introuvable." };
  if (!bon.email) return { ok: false, erreur: "Aucun email connu pour ce bon." };

  try {
    await archiverBiSiBesoin(supabase, bon as Bon);
  } catch {
    // Le PDF doit exister pour l'envoyer — si l'archivage échoue ici,
    // l'erreur est reportée à l'usager (contrairement à la validation,
    // où elle reste silencieuse).
    return { ok: false, erreur: "Échec de la génération du PDF." };
  }

  const { data: bonAvecPdf } = await supabase.from("bons_intervention").select("*").eq("id", id).single();
  const pdfBytes = await genererPdfAvecPhotos(supabase, bonAvecPdf as Bon);

  try {
    await envoyerConfirmationBI({ bon: bonAvecPdf as Bon, pdfBytes, informationComplementaire });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi." };
  }

  await supabase.from("bons_intervention").update({ statut: Statuts.envoye }).eq("id", id);
  revalidatePath(`/bi/${id}`);
  return { ok: true };
}

const CLASSEMENTS_VALIDES = new Set(["", "archiver", "facturer", "reception_travaux", "maintenance"]);
const FORMAT_MOIS_ANNEE = /^\d{2}-\d{4}$/;

/// Classement du BI, obligatoire avant validation bureau (voir
/// BlocClassement) : "archiver" (affiché "À Classer", rien à facturer),
/// "facturer" (mois de facturation saisi ensuite), "reception_travaux"
/// (prestation sur devis) ou "maintenance" — voir modifierMoisFacturation
/// côté devis, même principe pour le mois.
export async function classerBI(id: string, classement: string, moisFacturation: string): Promise<ActionResult> {
  await requireAdmin();
  if (!CLASSEMENTS_VALIDES.has(classement)) return { ok: false, erreur: "Classement invalide." };
  if (moisFacturation && !FORMAT_MOIS_ANNEE.test(moisFacturation)) {
    return { ok: false, erreur: "Format attendu : MM-AAAA (ex : 10-2026)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bons_intervention")
    .update({ classement, mois_facturation: classement === "facturer" ? moisFacturation : "" })
    .eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/bi/${id}`);
  revalidatePath("/bi/valides");
  return { ok: true };
}

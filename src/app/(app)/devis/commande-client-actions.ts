"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { extraireCommandeClient, type CommandeExtraiteResultat } from "@/lib/devis/commande-ocr";
import {
  BUCKET_COMMANDES,
  TYPES_COMMANDE_ACCEPTES,
  fichiersCommandeClient,
  type FichierCommandeClient,
} from "@/lib/devis/commande-client";

function nomDeFichierSur(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "commande";
}

/// Joint un ou plusieurs fichiers (PDF, JPG, PNG) à la commande client du devis.
export async function ajouterFichiersCommandeClient(devisId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const fichiers = formData.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.length === 0) return { ok: false, erreur: "Aucun fichier choisi." };
  const refuse = fichiers.find((f) => !TYPES_COMMANDE_ACCEPTES.includes(f.type));
  if (refuse) return { ok: false, erreur: `Format non accepté : ${refuse.name} (PDF, JPG ou PNG uniquement).` };

  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("commande_client").eq("id", devisId).single();
  if (!devis) return { ok: false, erreur: "Devis introuvable." };

  const ajoutes: FichierCommandeClient[] = [];
  for (const fichier of fichiers) {
    const chemin = `${devisId}/${Date.now()}-${nomDeFichierSur(fichier.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET_COMMANDES)
      .upload(chemin, Buffer.from(await fichier.arrayBuffer()), { contentType: fichier.type });
    if (error) return { ok: false, erreur: `Échec de l'envoi de ${fichier.name} : ${error.message}` };
    ajoutes.push({ chemin, nom: fichier.name, type: fichier.type, ajoute_le: new Date().toLocaleDateString("fr-FR") });
  }

  const { error } = await supabase
    .from("devis")
    .update({ commande_client: [...fichiersCommandeClient(devis.commande_client), ...ajoutes] })
    .eq("id", devisId);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/devis/${devisId}/statut`);
  return { ok: true };
}

export async function supprimerFichierCommandeClient(devisId: string, chemin: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("commande_client").eq("id", devisId).single();
  if (!devis) return { ok: false, erreur: "Devis introuvable." };

  await supabase.storage.from(BUCKET_COMMANDES).remove([chemin]);
  const { error } = await supabase
    .from("devis")
    .update({ commande_client: fichiersCommandeClient(devis.commande_client).filter((f) => f.chemin !== chemin) })
    .eq("id", devisId);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/devis/${devisId}/statut`);
  return { ok: true };
}

export async function urlFichierCommandeClient(chemin: string): Promise<string | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET_COMMANDES).createSignedUrl(chemin, 600);
  return data?.signedUrl ?? null;
}

/// Champs de la fiche client que la lecture peut compléter (vides seulement).
const CHAMPS_ENRICHISSABLES = {
  adresse_facturation: "Adresse facturation",
  complement_adresse_facturation: "Complément d'adresse facturation",
  code_postal_facturation: "Code Postal facturation",
  commune_facturation: "Commune facturation",
  interlocuteur_facturation: "Interlocuteur facturation",
  tel_fixe_interlocuteur_facturation: "Tel Fixe interlocuteur facturation",
  courriel_interlocuteur_facturation: "Courriel interlocuteur facturation",
  siret: "SIRET",
  tva_intracom: "N° TVA intracommunautaire",
  conditions_paiement: "Conditions de paiement",
} as const;
type ChampEnrichissable = keyof typeof CHAMPS_ENRICHISSABLES;

export type LectureCommande = {
  extraction: CommandeExtraiteResultat;
  reference: string;
  montantDevis: number | null;
  propositions: { cle: ChampEnrichissable; label: string; valeur: string }[];
};

async function analyser(devisId: string, bytes: Buffer, mimeType: string): Promise<ActionResult & { lecture?: LectureCommande }> {
  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("site_id, montant").eq("id", devisId).single();
  if (!devis) return { ok: false, erreur: "Devis introuvable." };

  let extraction: CommandeExtraiteResultat;
  try {
    extraction = await extraireCommandeClient({ bytes, mimeType });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Lecture impossible." };
  }

  const { data: site } = await supabase.from("sites").select(Object.keys(CHAMPS_ENRICHISSABLES).join(", ")).eq("id", devis.site_id).single();
  const actuel = (site ?? {}) as unknown as Record<string, string | null>;
  const lu: Record<ChampEnrichissable, string> = {
    adresse_facturation: [extraction.facturation.raison_sociale, extraction.facturation.adresse].filter(Boolean).join(" — "),
    complement_adresse_facturation: extraction.facturation.complement_adresse,
    code_postal_facturation: extraction.facturation.code_postal,
    commune_facturation: extraction.facturation.commune,
    interlocuteur_facturation: extraction.contact.nom,
    tel_fixe_interlocuteur_facturation: extraction.contact.telephone,
    courriel_interlocuteur_facturation: extraction.contact.email,
    siret: extraction.facturation.siret,
    tva_intracom: extraction.facturation.tva_intracom,
    conditions_paiement: extraction.conditions_paiement,
  };
  const propositions = (Object.keys(CHAMPS_ENRICHISSABLES) as ChampEnrichissable[])
    .filter((cle) => lu[cle].trim() && !(actuel[cle] ?? "").trim())
    .map((cle) => ({ cle, label: CHAMPS_ENRICHISSABLES[cle], valeur: lu[cle].trim() }));

  return {
    ok: true,
    lecture: {
      extraction,
      reference: extraction.numero_commande || (extraction.type_document === "devis_signe" ? "Devis signé" : ""),
      montantDevis: devis.montant,
      propositions,
    },
  };
}

/// Lecture d'un fichier déjà joint au devis.
export async function lireCommandeStockee(devisId: string, chemin: string): Promise<ActionResult & { lecture?: LectureCommande }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("commande_client").eq("id", devisId).single();
  const fichier = fichiersCommandeClient(devis?.commande_client).find((f) => f.chemin === chemin);
  if (!fichier) return { ok: false, erreur: "Fichier introuvable sur ce devis." };
  const { data } = await supabase.storage.from(BUCKET_COMMANDES).download(chemin);
  if (!data) return { ok: false, erreur: "Impossible de récupérer le fichier." };
  return analyser(devisId, Buffer.from(await data.arrayBuffer()), fichier.type);
}

/// Lecture d'un fichier choisi à "Marquer commandé", avant son envoi.
export async function lireCommandeFichier(devisId: string, formData: FormData): Promise<ActionResult & { lecture?: LectureCommande }> {
  await requireAdmin();
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, erreur: "Aucun fichier." };
  if (!TYPES_COMMANDE_ACCEPTES.includes(fichier.type)) return { ok: false, erreur: "Format non accepté (PDF, JPG ou PNG)." };
  return analyser(devisId, Buffer.from(await fichier.arrayBuffer()), fichier.type);
}

/// Enregistre ce que le bureau a retenu de la lecture. La fiche client n'est
/// complétée que dans ses champs encore vides, jamais écrasée.
export async function appliquerLectureCommande(
  devisId: string,
  choix: {
    champs: Partial<Record<ChampEnrichissable, string>>;
    montantCommande: number | null;
    commande?: { date: string; reference: string };
  },
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("site_id").eq("id", devisId).single();
  if (!devis) return { ok: false, erreur: "Devis introuvable." };

  const cles = (Object.keys(choix.champs) as ChampEnrichissable[]).filter((c) => c in CHAMPS_ENRICHISSABLES);
  if (cles.length > 0) {
    const { data: site } = await supabase.from("sites").select(cles.join(", ")).eq("id", devis.site_id).single();
    const actuel = (site ?? {}) as unknown as Record<string, string | null>;
    const maj = Object.fromEntries(
      cles.filter((c) => !(actuel[c] ?? "").trim() && (choix.champs[c] ?? "").trim()).map((c) => [c, (choix.champs[c] ?? "").trim()]),
    );
    if (Object.keys(maj).length > 0) {
      const { error } = await supabase.from("sites").update(maj).eq("id", devis.site_id);
      if (error) return { ok: false, erreur: error.message };
    }
  }

  const { error } = await supabase
    .from("devis")
    .update({
      montant_commande: choix.montantCommande,
      ecart_commande_confirme: false,
      ...(choix.commande
        ? { date_commande_client: choix.commande.date, reference_client: choix.commande.reference, annule: false }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", devisId);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/devis/${devisId}/statut`);
  revalidatePath("/devis");
  revalidatePath("/repertoire", "layout");
  return { ok: true };
}

export async function confirmerEcartCommande(devisId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("devis").update({ ecart_commande_confirme: true }).eq("id", devisId);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath(`/devis/${devisId}/statut`);
  return { ok: true };
}

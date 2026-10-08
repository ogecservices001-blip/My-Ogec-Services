"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import type { Interlocuteur } from "@/lib/validation/fournisseur";
import { initialesDe } from "@/lib/devis/numerotation";
import { piecesDepuisNumeroDevis, formaterNumeroCommande } from "@/lib/commandes-fournisseur/numerotation";
import type { LigneCommande } from "@/lib/commandes-fournisseur/format";
import { genererPdfCommande } from "@/lib/commandes-fournisseur/pdf";
import { envoyerCommandeFournisseur } from "@/lib/commandes-fournisseur/email";

const ERREUR_DOUBLON = "23505";
const ESSAIS_NUMERO = 5;

export type NouvelleCommandeInput = {
  devisId: string;
  fournisseurId: string;
  interlocuteur: Interlocuteur;
  lignes: LigneCommande[];
  tauxTva: number;
  devisFournisseurNumero: string;
  devisFournisseurDate: string;
  adresseLivraison: string;
  dateLivraisonPrevue: string;
  port: string;
  incoterm: string;
};

/// Crée une commande fournisseur, numéro attribué à l'enregistrement
/// (même principe que les devis : retry si collision de chrono).
export async function creerCommandeFournisseur(input: NouvelleCommandeInput): Promise<ActionResult & { id?: string }> {
  const profil = await requireAdmin();
  if (!input.fournisseurId) return { ok: false, erreur: "Choisis un fournisseur." };
  const lignesValides = input.lignes.filter((l) => l.designation.trim());
  if (lignesValides.length === 0) return { ok: false, erreur: "Ajoute au moins une ligne d'article." };

  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("numero").eq("id", input.devisId).single();
  if (!devis) return { ok: false, erreur: "Devis introuvable." };
  const pieces = piecesDepuisNumeroDevis(devis.numero);
  if (!pieces) return { ok: false, erreur: "Ce devis n'a pas de numéro exploitable pour numéroter la commande." };

  const { data: fournisseur } = await supabase
    .from("fournisseurs")
    .select("nom, denomination_courte")
    .eq("id", input.fournisseurId)
    .single();
  if (!fournisseur) return { ok: false, erreur: "Fournisseur introuvable." };
  const initialesFournisseur = fournisseur.denomination_courte || fournisseur.nom.slice(0, 4).toUpperCase();
  const initiales = initialesDe(profil.name);
  const dateCommande = new Date().toLocaleDateString("fr-FR");

  for (let essai = 0; essai < ESSAIS_NUMERO; essai++) {
    const { data: existantes } = await supabase
      .from("commandes_fournisseur")
      .select("chrono_fournisseur")
      .eq("fournisseur_id", input.fournisseurId)
      .order("chrono_fournisseur", { ascending: false })
      .limit(1);
    const chrono = (existantes?.[0]?.chrono_fournisseur ?? 0) + 1 + essai;
    const numero = formaterNumeroCommande({
      initiales,
      annee: pieces.annee,
      client: pieces.client,
      site: pieces.site,
      nature: pieces.nature,
      initialesFournisseur,
      chrono,
    });

    const { data, error } = await supabase
      .from("commandes_fournisseur")
      .insert({
        numero,
        devis_id: input.devisId,
        fournisseur_id: input.fournisseurId,
        interlocuteur: input.interlocuteur,
        chrono_fournisseur: chrono,
        redacteur: profil.name,
        date_commande: dateCommande,
        lignes: lignesValides,
        taux_tva: input.tauxTva,
        devis_fournisseur_numero: input.devisFournisseurNumero,
        devis_fournisseur_date: input.devisFournisseurDate,
        adresse_livraison: input.adresseLivraison,
        date_livraison_prevue: input.dateLivraisonPrevue,
        port: input.port,
        incoterm: input.incoterm,
      })
      .select("id")
      .single();
    if (!error && data) {
      revalidatePath("/commandes-fournisseur");
      revalidatePath(`/devis/${input.devisId}/statut`);
      return { ok: true, id: data.id };
    }
    if (error && error.code !== ERREUR_DOUBLON) return { ok: false, erreur: error.message };
  }
  return { ok: false, erreur: "Impossible d'attribuer un numéro, réessaie." };
}

export type SuiviCommandeInput = {
  date_livraison_prevue: string;
  livre: boolean;
  ar_fournisseur: string;
  relance: string;
  observations: string;
};

export async function modifierSuiviCommande(id: string, input: SuiviCommandeInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("commandes_fournisseur").update(input).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/commandes-fournisseur");
  revalidatePath(`/commandes-fournisseur/${id}`);
  return { ok: true };
}

export async function supprimerCommandeFournisseur(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("commandes_fournisseur").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/commandes-fournisseur");
  return { ok: true };
}

export async function envoyerCommandeParEmail(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: commande, error } = await supabase.from("commandes_fournisseur").select("*").eq("id", id).single();
  if (error || !commande) return { ok: false, erreur: "Commande introuvable." };
  const interlocuteur = commande.interlocuteur as unknown as Interlocuteur;
  if (!interlocuteur?.email) return { ok: false, erreur: "Aucun email connu pour l'interlocuteur choisi." };

  const [{ data: devis }, { data: fournisseur }] = await Promise.all([
    supabase.from("devis").select("*").eq("id", commande.devis_id).single(),
    supabase.from("fournisseurs").select("*").eq("id", commande.fournisseur_id).single(),
  ]);
  if (!devis || !fournisseur) return { ok: false, erreur: "Devis ou fournisseur introuvable." };

  const pdfBytes = await genererPdfCommande({ commande, devis, fournisseur });

  try {
    await envoyerCommandeFournisseur({ commande, fournisseur, interlocuteur, pdfBytes });
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de l'envoi." };
  }

  await supabase
    .from("commandes_fournisseur")
    .update({ envoyee_le: new Date().toLocaleDateString("fr-FR") })
    .eq("id", id);
  revalidatePath(`/commandes-fournisseur/${id}`);
  return { ok: true };
}

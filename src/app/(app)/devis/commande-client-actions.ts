"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

/// Supprime tous les équipements des sites donnés — un seul (depuis la
/// liste des sites d'un client), tous ceux d'un client, ou le parc
/// entier. Port de `GmaoDatabaseService.supprimerEquipementsPourClients`.
export async function supprimerEquipementsPourSites(siteIds: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (siteIds.length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("equipements").delete().in("site_id", siteIds);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/gmao");
  return { ok: true };
}

const sansAccent = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/// Terrain : ajoute une marque à la liste de la famille (seulement celle-ci).
/// Une marque déjà connue, à la casse, aux accents ou aux espaces près, n'est
/// pas recréée : la marque existante est renvoyée.
export async function ajouterMarqueFamille(
  typeEquipementId: string,
  marque: string,
): Promise<{ ok: true; marque: string } | { ok: false; erreur: string }> {
  await requireProfile();
  const propre = marque.replace(/\s+/g, " ").trim();
  if (!propre) return { ok: false, erreur: "Saisis le nom de la marque." };
  if (propre.length > 60) return { ok: false, erreur: "Nom de marque trop long." };

  const supabase = await createClient();
  const { data: type } = await supabase
    .from("types_equipement")
    .select("champs_en_tete_supplementaires")
    .eq("id", typeEquipementId)
    .single();
  if (!type) return { ok: false, erreur: "Famille introuvable." };
  const champs = (type.champs_en_tete_supplementaires as { cle: string; options?: string[] }[]) ?? [];
  const champMarque = champs.find((c) => c.cle === "marque");
  if (!champMarque) return { ok: false, erreur: "Cette famille n'a pas de champ Marque." };

  const existante = (champMarque.options ?? []).find((o) => sansAccent(o) === sansAccent(propre));
  if (existante) return { ok: true, marque: existante };

  const { error } = await supabase.rpc("ajouter_marque_famille", { p_type_id: typeEquipementId, p_marque: propre });
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/gmao/referentiel/familles");
  return { ok: true, marque: propre };
}

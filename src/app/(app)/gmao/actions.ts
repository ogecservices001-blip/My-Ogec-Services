"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
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

"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

export async function marquerIncidentResolu(id: string): Promise<ActionResult> {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({ resolu_le: new Date().toISOString(), resolu_par: profile.name })
    .eq("id", id)
    .is("resolu_le", null);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath("/erreurs");
  revalidatePath("/");
  return { ok: true };
}

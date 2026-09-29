"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";

export async function marquerTraitee(id: string): Promise<ActionResult> {
  await requireProfile();

  const supabase = await createClient();
  const { error } = await supabase.from("demandes_depannage").update({ statut: "traitee" }).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/depannages");
  return { ok: true };
}

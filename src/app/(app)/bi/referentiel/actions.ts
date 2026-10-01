"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import type { ChampEnTete, ChecklistItem } from "@/lib/gmao/types";

export type ModeleBiInput = {
  champs: ChampEnTete[];
  checklist: ChecklistItem[];
  texte_type: string;
};

/// Upsert par pôle — un modèle par pôle, jamais dupliqué (voir
/// migration 0021). Admin uniquement, consulté en direct par
/// l'assistant BI à chaque création.
export async function enregistrerModeleBI(pole: string, input: ModeleBiInput): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("bi_modeles")
    .upsert({ pole, ...input }, { onConflict: "pole" });
  if (error) return { ok: false, erreur: error.message };

  revalidatePath("/bi/referentiel");
  return { ok: true };
}

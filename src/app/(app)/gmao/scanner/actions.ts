"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export type ResultatResolutionQr =
  | { ok: true; siteId: string; equipementId: string }
  | { ok: false; erreur: string };

/// Retrouve l'équipement correspondant à un `code_qr` scanné — pour
/// sauter directement à sa fiche depuis l'appli (raccourci technicien),
/// sans passer par la page publique /q/{code}.
export async function resoudreCodeQr(code: string): Promise<ResultatResolutionQr> {
  await requireProfile();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipements")
    .select("id, site_id")
    .eq("code_qr", code)
    .single();
  if (error || !data) return { ok: false, erreur: `Aucun équipement pour le code "${code}".` };

  return { ok: true, siteId: data.site_id, equipementId: data.id };
}

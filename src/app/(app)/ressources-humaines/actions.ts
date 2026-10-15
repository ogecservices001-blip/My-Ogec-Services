"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import type { Pointage } from "@/lib/types";

function bornesMois(mois: string): { debut: string; fin: string } {
  const [annee, m] = mois.split("-").map(Number);
  const debut = `${mois}-01`;
  const dernierJour = new Date(Date.UTC(annee, m, 0)).getUTCDate();
  const fin = `${mois}-${String(dernierJour).padStart(2, "0")}`;
  return { debut, fin };
}

/// Importe (ou réimporte) les heures du planning pour un mois donné —
/// toujours une photo figée : réimporter remplace entièrement les
/// lignes déjà importées pour ce mois (idempotent), jamais un cumul.
/// Un créneau à plusieurs techniciens donne une ligne de pointage par
/// technicien, avec les heures du créneau telles quelles (pas
/// divisées) — même convention que la facturation multi-technicien du
/// BI.
export async function importerPointagesDuMois(mois: string): Promise<ActionResult & { importes?: number }> {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { debut, fin } = bornesMois(mois);

  const { error: errSuppr } = await supabase.from("pointages").delete().eq("mois", mois);
  if (errSuppr) return { ok: false, erreur: errSuppr.message };

  const { data: creneaux, error: errCreneaux } = await supabase
    .from("creneaux_planning")
    .select("id, date, heures_prevues, client_nom, site, observations, creneau_techniciens(technicien_id, profiles(name))")
    .eq("annule", false)
    .gte("date", debut)
    .lte("date", fin);
  if (errCreneaux) return { ok: false, erreur: errCreneaux.message };

  const lignes = (creneaux ?? []).flatMap((c) =>
    (c.creneau_techniciens ?? []).flatMap((ct) => {
      const profils = Array.isArray(ct.profiles) ? ct.profiles : ct.profiles ? [ct.profiles] : [];
      return profils.map((p) => ({
        technicien_id: ct.technicien_id,
        technicien_nom: p.name,
        date: c.date,
        mois,
        heures: Number(c.heures_prevues),
        client_nom: c.client_nom,
        site: c.site,
        observations: c.observations,
        creneau_id: c.id,
        importe_par: profile.id,
      }));
    }),
  );

  if (lignes.length > 0) {
    const { error: errInsert } = await supabase.from("pointages").insert(lignes);
    if (errInsert) return { ok: false, erreur: errInsert.message };
  }

  revalidatePath("/ressources-humaines");
  return { ok: true, importes: lignes.length };
}

export async function chargerPointagesDuMois(mois: string): Promise<Pointage[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("pointages")
    .select("*")
    .eq("mois", mois)
    .order("technicien_nom")
    .order("date");
  return (data ?? []).map((p) => ({ ...p, heures: Number(p.heures) }));
}

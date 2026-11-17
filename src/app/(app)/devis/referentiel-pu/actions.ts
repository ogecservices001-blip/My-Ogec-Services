"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { articlePUSchema, aujourdhuiISO, type ArticlePU } from "@/lib/devis/referentiel-pu";
import type { ActionResult } from "@/lib/action-result";

const CHEMIN = "/devis/referentiel-pu";

export async function creerArticlePU(
  _prevState: (ActionResult & { article?: ArticlePU }) | null,
  formData: FormData,
): Promise<ActionResult & { article?: ArticlePU }> {
  await requireAdmin();
  const parsed = articlePUSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const supabase = await createClient();
  const { data: dernier } = await supabase
    .from("referentiel_pu")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const date_maj_tarif = parsed.data.date_maj_tarif ?? (parsed.data.tarif_net_ht !== null ? aujourdhuiISO() : null);
  const { data: article, error } = await supabase
    .from("referentiel_pu")
    .insert({ ...parsed.data, date_maj_tarif, ordre: (dernier?.ordre ?? 0) + 1 })
    .select("*")
    .single();
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(CHEMIN);
  return { ok: true, article: article as ArticlePU };
}

export async function modifierArticlePU(id: string, _prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = articlePUSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, erreur: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const supabase = await createClient();
  const { data: avant } = await supabase.from("referentiel_pu").select("tarif_net_ht, date_maj_tarif").eq("id", id).single();
  if (!avant) return { ok: false, erreur: "Article introuvable." };
  const ancienTarif = avant.tarif_net_ht === null ? null : Number(avant.tarif_net_ht);
  const tarifChange =
    ancienTarif === null || parsed.data.tarif_net_ht === null
      ? ancienTarif !== parsed.data.tarif_net_ht
      : Math.abs(ancienTarif - parsed.data.tarif_net_ht) >= 0.005;
  const ancienneDate = avant.date_maj_tarif ? avant.date_maj_tarif.slice(0, 10) : null;
  const date_maj_tarif =
    tarifChange && parsed.data.date_maj_tarif === ancienneDate ? aujourdhuiISO() : parsed.data.date_maj_tarif;
  const { error } = await supabase.from("referentiel_pu").update({ ...parsed.data, date_maj_tarif }).eq("id", id);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(CHEMIN);
  return { ok: true };
}

export async function supprimerArticlePU(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("referentiel_pu").delete().eq("id", id);
  if (error) return { ok: false, erreur: error.message };
  revalidatePath(CHEMIN);
  return { ok: true };
}

export async function supprimerArticlesPU(ids: string[]): Promise<ActionResult & { supprimes?: number }> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, erreur: "Aucun article sélectionné." };
  const supabase = await createClient();
  let supprimes = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const lot = ids.slice(i, i + 500);
    const { error } = await supabase.from("referentiel_pu").delete().in("id", lot);
    if (error) return { ok: false, erreur: error.message };
    supprimes += lot.length;
  }
  revalidatePath(CHEMIN);
  return { ok: true, supprimes };
}

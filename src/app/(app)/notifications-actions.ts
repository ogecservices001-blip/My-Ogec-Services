"use server";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifierProfil } from "@/lib/notifications/push";
import type { ActionResult } from "@/lib/action-result";

export type AbonnementNavigateur = { endpoint: string; keys: { p256dh: string; auth: string } };

/// Ce téléphone reçoit désormais les notifications du technicien connecté.
/// Client admin : un téléphone déjà abonné par un autre compte (téléphone
/// prêté) est repris par celui qui l'utilise maintenant.
export async function enregistrerAbonnement(abonnement: AbonnementNavigateur, appareil: string): Promise<ActionResult> {
  const profile = await requireProfile();
  const { endpoint, keys } = abonnement;
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys?.auth) return { ok: false, erreur: "Abonnement invalide." };
  const { error } = await createAdminClient()
    .from("abonnements_push")
    .upsert(
      { profile_id: profile.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, appareil: appareil.slice(0, 200) },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, erreur: error.message };
  await notifierProfil(profile.id, {
    titre: "Notifications activées",
    texte: "Tu seras prévenu ici dès qu'un dépannage t'est affecté.",
    url: "/",
    tag: "activation",
  });
  return { ok: true };
}

export async function supprimerAbonnement(endpoint: string): Promise<void> {
  const profile = await requireProfile();
  await createAdminClient().from("abonnements_push").delete().eq("endpoint", endpoint).eq("profile_id", profile.id);
}

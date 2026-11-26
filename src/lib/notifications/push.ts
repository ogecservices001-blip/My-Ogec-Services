import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { URL_APPLI } from "@/lib/planning/validation";

export type NotificationPush = { titre: string; texte: string; url: string; tag?: string };

function configure(): boolean {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) return false;
  webpush.setVapidDetails(URL_APPLI, publique, privee);
  return true;
}

/// Notification sur le(s) téléphone(s) d'un technicien. Ne bloque jamais
/// l'action qui l'appelle : un échec est seulement journalisé. Le client
/// admin est nécessaire pour lire les abonnements d'un autre utilisateur
/// (le bureau prévient le technicien).
export async function notifierProfil(profileId: string, notification: NotificationPush): Promise<void> {
  try {
    if (!configure()) return;
    const admin = createAdminClient();
    const { data: abonnements } = await admin
      .from("abonnements_push")
      .select("id, endpoint, p256dh, auth")
      .eq("profile_id", profileId);
    const contenu = JSON.stringify(notification);
    await Promise.all(
      (abonnements ?? []).map(async (a) => {
        try {
          await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, contenu, {
            TTL: 24 * 3600,
            urgency: "high",
          });
        } catch (e) {
          const statut = (e as { statusCode?: number }).statusCode;
          // Téléphone désabonné ou appli désinstallée : abonnement périmé.
          if (statut === 404 || statut === 410) await admin.from("abonnements_push").delete().eq("id", a.id);
          else console.error("Notification non envoyée", statut ?? e);
        }
      }),
    );
  } catch (e) {
    console.error("Notification non envoyée", e);
  }
}

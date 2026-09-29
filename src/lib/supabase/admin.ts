import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/// Client Supabase avec la clé secrète (contourne RLS) — réservé aux
/// Server Actions qui doivent servir un visiteur anonyme non connecté
/// (page publique équipement /q/{code}) et qui font elles-mêmes leur
/// propre vérification d'autorisation (email connu du site), comme les
/// Cloud Functions `verifierAccesEquipement`/`soumettreDemandeDepannage`
/// utilisaient firebase-admin côté Flutter. Ne JAMAIS utiliser côté
/// client, ni pour une action déjà couverte par une session utilisateur
/// normale (createClient() de supabase/server suffit alors).
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

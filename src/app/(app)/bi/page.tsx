import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BiListe } from "./liste";

/// Registre complet + validation — réservé au bureau (voir sidebar :
/// un technicien ne voit même pas le lien). Un technicien peut encore
/// consulter un BI précis en lecture seule via /bi/[id] si on lui en
/// donne le lien, juste pas cette liste.
export default async function BiPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("id, numero, statut, pole, client_nom, site, updated_at")
    .order("updated_at", { ascending: false });

  return <BiListe bons={bons ?? []} />;
}

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BiListe } from "./liste";

export default async function BiPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("id, numero, statut, pole, client_nom, site, updated_at")
    .order("updated_at", { ascending: false });

  return <BiListe bons={bons ?? []} />;
}

import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ArticlePU } from "@/lib/devis/referentiel-pu";
import { ReferentielPUListe } from "./referentiel-liste";

export default async function ReferentielPUPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const { data } = await supabase.from("referentiel_pu").select("*").order("ordre").order("created_at");

  return <ReferentielPUListe articles={(data as ArticlePU[]) ?? []} />;
}

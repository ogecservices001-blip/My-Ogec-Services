import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculerLignesHeuresParPole } from "./calcul";
import { HeuresParPoleTableau } from "./tableau";

export default async function HeuresParPolePage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const lignes = await calculerLignesHeuresParPole(supabase);

  return <HeuresParPoleTableau lignes={lignes} />;
}

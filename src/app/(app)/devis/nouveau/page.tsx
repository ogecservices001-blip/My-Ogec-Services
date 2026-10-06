import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NATURE_DEVIS } from "@/lib/devis/constants";
import { NouveauDevisForm } from "./nouveau-devis-form";

export default async function NouveauDevisPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites_view").select("id, nom, site, hors_contrat").order("nom");

  return (
    <NouveauDevisForm
      sites={(sites ?? []).map((s) => ({ id: s.id, nom: s.nom, site: s.site, horsContrat: s.hors_contrat }))}
      natures={Object.entries(NATURE_DEVIS).map(([valeur, label]) => ({ valeur, label }))}
    />
  );
}

import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NATURE_DEVIS } from "@/lib/devis/constants";
import { NouveauDevisForm } from "./nouveau-devis-form";

export default async function NouveauDevisPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id, nom, site").order("nom");

  return (
    <NouveauDevisForm
      sites={(sites ?? []).map((s) => ({ id: s.id, label: [s.nom, s.site].filter(Boolean).join(" — ") }))}
      natures={Object.entries(NATURE_DEVIS).map(([valeur, label]) => ({ valeur, label }))}
    />
  );
}

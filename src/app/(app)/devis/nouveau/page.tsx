import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NATURE_DEVIS } from "@/lib/devis/constants";
import { NouveauDevisForm } from "./nouveau-devis-form";

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: Promise<{ equipementId?: string }>;
}) {
  await requireAdminOuAccueil();
  const { equipementId } = await searchParams;
  const supabase = await createClient();

  const [{ data: sites }, prefill] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").order("nom"),
    equipementId ? chargerPrefill(supabase, equipementId) : Promise.resolve(null),
  ]);

  return (
    <NouveauDevisForm
      sites={(sites ?? []).map((s) => ({ id: s.id, nom: s.nom, site: s.site, horsContrat: s.hors_contrat }))}
      natures={Object.entries(NATURE_DEVIS).map(([valeur, label]) => ({ valeur, label }))}
      prefill={prefill}
    />
  );
}

async function chargerPrefill(supabase: Awaited<ReturnType<typeof createClient>>, equipementId: string) {
  const { data: eq } = await supabase.from("equipements").select("site_id").eq("id", equipementId).single();
  if (!eq) return null;
  const { data: site } = await supabase.from("sites_view").select("id, nom, hors_contrat").eq("id", eq.site_id).single();
  if (!site) return null;
  return {
    equipementId,
    siteId: site.id,
    clientNom: site.nom,
    type: (site.hors_contrat ? "hors" : "sous") as "hors" | "sous",
  };
}

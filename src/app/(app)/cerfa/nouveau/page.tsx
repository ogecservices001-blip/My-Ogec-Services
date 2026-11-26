import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CerfaWizard, type SiteCerfa } from "./wizard";

export default async function NouveauCerfaPage({
  searchParams,
}: {
  searchParams: Promise<{ equipementId?: string }>;
}) {
  const profile = await requireProfile();
  const { equipementId } = await searchParams;
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites_view")
    .select(
      "id, nom, site, n_affaire, adresse, complement_adresse, code_postal, commune, interlocuteur_site, qualite_interlocuteur_site, courriel_interlocuteur_site, interlocuteur_site_2, qualite_interlocuteur_site_2, courriel_interlocuteur_site_2, interlocuteur_site_3, qualite_interlocuteur_site_3, courriel_interlocuteur_site_3, interlocuteur_site_4, qualite_interlocuteur_site_4, courriel_interlocuteur_site_4",
    )
    .order("nom");

  let depart: { siteId: string; equipementId: string } | null = null;
  if (equipementId) {
    const { data: eq } = await supabase.from("equipements").select("id, site_id").eq("id", equipementId).maybeSingle();
    if (eq?.site_id) depart = { siteId: eq.site_id, equipementId: eq.id };
  }

  return <CerfaWizard sites={(sites ?? []) as SiteCerfa[]} operateurNom={profile.name ?? ""} depart={depart} />;
}

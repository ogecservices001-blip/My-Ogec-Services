import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImporterEquipementsClient } from "../importer-client";

export default async function ImporterGlobalPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id");
  const siteIds = (sites ?? []).map((s) => s.id);

  return (
    <ImporterEquipementsClient
      titre="Importer des équipements — tous clients"
      sousTitre='Classeur "Sommaire" partagé, rattachement automatique par Numéro Client/Site.'
      siteIds={siteIds}
      retourHref="/gmao"
      cheminsARevalider={["/gmao"]}
    />
  );
}

import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImporterEquipementsClient } from "@/app/(app)/gmao/importer-client";

export default async function ImporterEquipementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOuAccueil();
  const { id } = await params;
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("nom, site").eq("id", id).single();

  return (
    <ImporterEquipementsClient
      titre="Importer des équipements"
      sousTitre={`${[site?.nom, site?.site].filter(Boolean).join(" — ")} — Classeur "Sommaire", rapprochement par Numéro Équipement.`}
      siteIds={[id]}
      retourHref={`/gmao/clients/${id}/equipements`}
      cheminsARevalider={[`/gmao/clients/${id}/equipements`]}
    />
  );
}

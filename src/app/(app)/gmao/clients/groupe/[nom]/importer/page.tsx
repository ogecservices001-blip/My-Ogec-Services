import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImporterEquipementsClient } from "@/app/(app)/gmao/importer-client";

export default async function ImporterPourClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ nom: string }>;
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  await requireAdmin();
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);
  const { horsContrat } = await searchParams;

  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id").eq("nom", nomDecode);
  const siteIds = (sites ?? []).map((s) => s.id);

  return (
    <ImporterEquipementsClient
      titre={`Importer des équipements — ${nomDecode}`}
      sousTitre='Classeur "Sommaire", rattachement automatique aux sites de ce client par Numéro Client/Site.'
      siteIds={siteIds}
      retourHref={`/gmao/clients/groupe/${nom}?horsContrat=${horsContrat === "1" ? "1" : "0"}`}
      cheminsARevalider={[`/gmao/clients/groupe/${nom}`]}
    />
  );
}

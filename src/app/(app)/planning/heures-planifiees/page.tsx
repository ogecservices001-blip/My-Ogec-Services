import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculerHeuresPlanifiees } from "@/lib/planning/heures-planifiees";
import { HeuresPlanifieesVue } from "./vue";

export default async function HeuresPlanifieesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; site?: string; annee?: string }>;
}) {
  await requireAdmin();
  const { client = "", site = "", annee: anneeParam } = await searchParams;
  const annee = Number(anneeParam) >= 2000 && Number(anneeParam) <= 2100 ? Number(anneeParam) : new Date().getFullYear();
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites_view").select("id, nom, site").order("nom");

  const siteIds = site ? [site] : client ? (sites ?? []).filter((s) => s.nom === client).map((s) => s.id) : [];
  const resultat = siteIds.length ? await calculerHeuresPlanifiees(supabase, siteIds, annee) : null;

  return <HeuresPlanifieesVue key={`${client}|${site}|${annee}`} sites={sites ?? []} client={client} siteId={site} annee={annee} resultat={resultat} />;
}

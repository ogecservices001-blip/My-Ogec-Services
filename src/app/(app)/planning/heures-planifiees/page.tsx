import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculerHeuresPlanifiees, contratDuFiltre, lireFiltrePole } from "@/lib/planning/heures-planifiees";
import { HeuresPlanifieesVue } from "./vue";

export default async function HeuresPlanifieesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; site?: string; annee?: string; pole?: string }>;
}) {
  await requireAdmin();
  const { client = "", site = "", annee: anneeParam, pole: poleParam } = await searchParams;
  const pole = lireFiltrePole(poleParam);
  const annee = Number(anneeParam) >= 2000 && Number(anneeParam) <= 2100 ? Number(anneeParam) : new Date().getFullYear();
  const supabase = await createClient();
  const contrat = contratDuFiltre(pole);
  const { data: tousSites } = await supabase.from("sites_view").select("id, nom, site, n_affaire, hors_contrat").order("nom");
  const sites = (tousSites ?? [])
    .filter((s) => contrat === null || Boolean(s.hors_contrat) === (contrat === "hors"))
    .map((s) => ({ id: s.id as string, nom: s.nom ?? "", site: s.site ?? "" }));

  const siteValide = site && sites.some((s) => s.id === site) ? site : "";
  const clientValide = client && sites.some((s) => s.nom === client) ? client : "";
  const siteIds = siteValide ? [siteValide] : clientValide ? sites.filter((s) => s.nom === clientValide).map((s) => s.id) : null;
  const resultat = await calculerHeuresPlanifiees(supabase, siteIds, annee, contrat);

  return (
    <HeuresPlanifieesVue
      key={`${client}|${site}|${annee}|${pole}`}
      sites={sites}
      client={clientValide}
      siteId={siteValide}
      annee={annee}
      pole={pole}
      resultat={resultat}
    />
  );
}

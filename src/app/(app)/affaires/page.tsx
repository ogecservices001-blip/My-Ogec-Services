import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site, Tables } from "@/lib/types";
import { AffairesClientsListe, type ClientGroupe } from "./clients-liste";

export default async function AffairesClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: sites }, { data: affaires }] = await Promise.all([
    supabase.from("sites_view").select("*").eq("hors_contrat", horsContrat).order("nom"),
    supabase.from("affaires").select("*"),
  ]);

  const affairesParSite = new Map<string, Tables<"affaires">[]>();
  for (const a of affaires ?? []) {
    const liste = affairesParSite.get(a.site_id) ?? [];
    liste.push(a);
    affairesParSite.set(a.site_id, liste);
  }

  const sitesParNom = new Map<string, Site[]>();
  for (const s of (sites ?? []) as Site[]) {
    if (!affairesParSite.has(s.id)) continue;
    const liste = sitesParNom.get(s.nom) ?? [];
    liste.push(s);
    sitesParNom.set(s.nom, liste);
  }

  const groupes: ClientGroupe[] = [...sitesParNom.entries()]
    .map(([nom, sitesClient]) => ({
      nom,
      sites: sitesClient.map((s) => ({
        id: s.id,
        site: s.site,
        nbAffaires: affairesParSite.get(s.id)?.length ?? 0,
      })),
      nbAffaires: sitesClient.reduce((n, s) => n + (affairesParSite.get(s.id)?.length ?? 0), 0),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <AffairesClientsListe
      groupes={groupes}
      horsContrat={horsContrat}
      isAdmin={profile?.role === "admin"}
    />
  );
}

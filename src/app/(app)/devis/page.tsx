import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site, Tables } from "@/lib/types";
import { DevisClientsListe, type ClientGroupe } from "./clients-liste";

export default async function DevisClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: sites }, { data: devis }] = await Promise.all([
    supabase.from("sites_view").select("*").eq("hors_contrat", horsContrat).order("nom"),
    supabase.from("devis").select("*"),
  ]);

  const devisParSite = new Map<string, Tables<"devis">[]>();
  for (const d of devis ?? []) {
    const liste = devisParSite.get(d.site_id) ?? [];
    liste.push(d);
    devisParSite.set(d.site_id, liste);
  }

  const sitesParNom = new Map<string, Site[]>();
  for (const s of (sites ?? []) as Site[]) {
    if (!devisParSite.has(s.id)) continue;
    const liste = sitesParNom.get(s.nom) ?? [];
    liste.push(s);
    sitesParNom.set(s.nom, liste);
  }

  const groupes: ClientGroupe[] = [...sitesParNom.entries()]
    .map(([nom, sitesClient]) => {
      const devisClient = sitesClient.flatMap((s) => devisParSite.get(s.id) ?? []);
      return {
        nom,
        sites: sitesClient.map((s) => ({ id: s.id, site: s.site, nbDevis: devisParSite.get(s.id)?.length ?? 0 })),
        nbDevis: devisClient.length,
        nbCommandes: devisClient.filter((d) => d.date_commande_client).length,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <DevisClientsListe groupes={groupes} horsContrat={horsContrat} isAdmin={profile?.role === "admin"} />
  );
}

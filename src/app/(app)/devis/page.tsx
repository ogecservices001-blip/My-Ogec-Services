import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site } from "@/lib/types";
import { ChronoDevis } from "./chrono-devis";
import type { DevisRegistreLigne } from "./registre-liste";

export default async function DevisChronoPage({
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

  const siteParId = new Map(((sites ?? []) as Site[]).map((s) => [s.id, s]));

  // Registre chrono : tous les devis du filtre en cours, à plat, du
  // plus récent au plus ancien (created_at, fiable contrairement à
  // date_devis saisi en texte libre côté import).
  const registre: DevisRegistreLigne[] = (devis ?? [])
    .filter((d) => siteParId.has(d.site_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((d) => {
      const site = siteParId.get(d.site_id);
      return {
        id: d.id,
        numero: d.numero,
        clientNom: site?.nom ?? "",
        clientSite: site?.site ?? "",
        libelle: d.libelle,
        nature: d.nature,
        montant: d.montant,
        dateDevis: d.date_devis,
        commande: Boolean(d.date_commande_client),
        annule: d.annule,
      };
    });

  return <ChronoDevis registre={registre} horsContrat={horsContrat} isAdmin={profile?.role === "admin"} />;
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site, Tables } from "@/lib/types";
import { DevisClientsListe, type ClientGroupe, type DevisRegistreLigne } from "./clients-liste";

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

  const sitesFiltres = (sites ?? []) as Site[];
  const siteParId = new Map(sitesFiltres.map((s) => [s.id, s]));

  const devisParSite = new Map<string, Tables<"devis">[]>();
  for (const d of devis ?? []) {
    if (!siteParId.has(d.site_id)) continue; // hors du filtre sous/hors contrat en cours
    const liste = devisParSite.get(d.site_id) ?? [];
    liste.push(d);
    devisParSite.set(d.site_id, liste);
  }

  const sitesParNom = new Map<string, Site[]>();
  for (const s of sitesFiltres) {
    if (!devisParSite.has(s.id)) continue;
    const liste = sitesParNom.get(s.nom) ?? [];
    liste.push(s);
    sitesParNom.set(s.nom, liste);
  }

  const groupes: ClientGroupe[] = [...sitesParNom.entries()]
    .map(([nom, sitesClient]) => {
      const devisClient = sitesClient.flatMap((s) => devisParSite.get(s.id) ?? []);
      const commandes = devisClient.filter((d) => d.date_commande_client);
      return {
        nom,
        sites: sitesClient.map((s) => ({ id: s.id, site: s.site, nbDevis: devisParSite.get(s.id)?.length ?? 0 })),
        nbDevis: devisClient.length,
        nbCommandes: commandes.length,
        montantTotal: devisClient.reduce((s, d) => s + (d.montant ?? 0), 0),
        montantCommande: commandes.reduce((s, d) => s + (d.montant ?? 0), 0),
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

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

  return (
    <DevisClientsListe
      groupes={groupes}
      registre={registre}
      horsContrat={horsContrat}
      isAdmin={profile?.role === "admin"}
    />
  );
}

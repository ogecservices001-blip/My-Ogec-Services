import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Equipement, ReferenceHoraire } from "@/lib/gmao/types";
import type { Site } from "@/lib/types";
import { freqCouranteCalculeeBatch } from "@/lib/gmao/releve-service";
import { sommeHeuresAnnee } from "@/lib/gmao/calcul-heures-visite";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";
import { supprimerEquipementsPourSites } from "@/app/(app)/gmao/actions";
import { GmaoClientsListe, type LigneSiteGmao } from "./clients-liste";

export default async function GmaoClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const [{ data: sitesData }, { data: references }] = await Promise.all([
    supabase.from("sites_view").select("*").eq("hors_contrat", horsContrat).order("nom"),
    supabase.from("references_horaires").select("*"),
  ]);
  const sites = (sitesData ?? []) as Site[];

  const siteIds = sites.map((s) => s.id);
  const listeEquipements = await recupererToutesLesLignes<Equipement>((debut, fin) =>
    supabase.from("equipements").select("*").in("site_id", siteIds).range(debut, fin),
  );
  const freqCouranteParEquipement = await freqCouranteCalculeeBatch(
    supabase,
    listeEquipements.map((e) => e.id),
  );
  const equipementsParSite = new Map<string, Equipement[]>();
  for (const eq of listeEquipements) {
    const liste = equipementsParSite.get(eq.site_id) ?? [];
    liste.push(eq);
    equipementsParSite.set(eq.site_id, liste);
  }

  const references_ = (references ?? []) as ReferenceHoraire[];
  const lignes: LigneSiteGmao[] = sites.map((s) => ({
    id: s.id,
    nom: s.nom,
    site: s.site,
    adresse: s.adresse,
    complement_adresse: s.complement_adresse,
    code_postal: s.code_postal,
    commune: s.commune,
    heures: sommeHeuresAnnee(equipementsParSite.get(s.id) ?? [], references_, freqCouranteParEquipement),
  }));

  return (
    <GmaoClientsListe
      lignes={lignes}
      horsContrat={horsContrat}
      isAdmin={isAdmin}
      tousLesSiteIds={siteIds}
      supprimerAction={supprimerEquipementsPourSites.bind(null, siteIds)}
    />
  );
}

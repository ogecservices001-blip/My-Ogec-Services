import { createClient } from "@/lib/supabase/server";
import type { Equipement, ReferenceHoraire } from "@/lib/gmao/types";
import { freqCouranteCalculeeBatch } from "@/lib/gmao/releve-service";
import { sommeHeuresAnnee } from "@/lib/gmao/calcul-heures-visite";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";
import { GmaoClientsListe, type ClientGroupe } from "./clients-liste";

export default async function GmaoClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const [{ data: sites }, { data: references }] = await Promise.all([
    supabase.from("sites_view").select("*").eq("hors_contrat", horsContrat).order("nom"),
    supabase.from("references_horaires").select("*"),
  ]);

  const siteIds = (sites ?? []).map((s) => s.id);
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

  const sitesParNom = new Map<string, { id: string; nom: string; site: string }[]>();
  for (const s of sites ?? []) {
    const liste = sitesParNom.get(s.nom) ?? [];
    liste.push({ id: s.id, nom: s.nom, site: s.site });
    sitesParNom.set(s.nom, liste);
  }

  const references_ = (references ?? []) as ReferenceHoraire[];
  const groupes: ClientGroupe[] = [...sitesParNom.entries()]
    .map(([nom, sitesClient]) => {
      const equipementsClient = sitesClient.flatMap((s) => equipementsParSite.get(s.id) ?? []);
      return {
        nom,
        siteIds: sitesClient.map((s) => s.id),
        nbSites: sitesClient.length,
        heures: sommeHeuresAnnee(equipementsClient, references_, freqCouranteParEquipement),
        siteUniqueId: sitesClient.length === 1 ? sitesClient[0].id : null,
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <GmaoClientsListe
      groupes={groupes}
      horsContrat={horsContrat}
      titre={horsContrat ? "GMAO — Clients hors contrat" : "GMAO — Clients sous contrat"}
    />
  );
}

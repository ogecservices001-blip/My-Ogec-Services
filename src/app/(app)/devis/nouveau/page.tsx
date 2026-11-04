import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NATURES_DEVIS_SELECTIONNABLES } from "@/lib/devis/constants";
import { ModalEcran } from "@/components/modal-ecran";
import { coutRevientDefaut, type CoutRevient, type LigneDevis } from "@/lib/devis/pricing";
import { NouveauDevisForm } from "./nouveau-devis-form";

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: Promise<{ equipementId?: string; compteRendu?: string; brouillonId?: string }>;
}) {
  await requireAdminOuAccueil();
  const { equipementId, compteRendu, brouillonId } = await searchParams;
  const supabase = await createClient();

  const [{ data: sites }, prefillSite, brouillon] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").order("nom"),
    equipementId ? chargerPrefill(supabase, equipementId) : Promise.resolve(null),
    brouillonId ? chargerBrouillon(supabase, brouillonId) : Promise.resolve(null),
  ]);
  const prefill = prefillSite ? { ...prefillSite, compteRendu: compteRendu ?? "" } : null;

  return (
    <ModalEcran titre={brouillon ? "Reprendre le devis en cours" : "Nouveau devis"} hrefFermer="/devis" large>
      <NouveauDevisForm
        sites={(sites ?? []).map((s) => ({ id: s.id, nom: s.nom, site: s.site, horsContrat: s.hors_contrat }))}
        natures={Object.entries(NATURES_DEVIS_SELECTIONNABLES).map(([valeur, label]) => ({ valeur, label }))}
        prefill={prefill}
        brouillon={brouillon}
      />
    </ModalEcran>
  );
}

async function chargerBrouillon(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: devis } = await supabase.from("devis").select("*").eq("id", id).single();
  if (!devis) return null;
  const { data: site } = await supabase.from("sites_view").select("id, nom, hors_contrat").eq("id", devis.site_id).single();
  if (!site) return null;
  return {
    id: devis.id,
    siteId: devis.site_id,
    clientNom: site.nom,
    type: (site.hors_contrat ? "hors" : "sous") as "hors" | "sous",
    equipementId: devis.equipement_id ?? "",
    libelle: devis.libelle,
    nature: devis.nature,
    lignes: (devis.lignes ?? []) as unknown as LigneDevis[],
    coutRevient: (devis.cout_revient as unknown as CoutRevient) ?? coutRevientDefaut(),
  };
}

async function chargerPrefill(supabase: Awaited<ReturnType<typeof createClient>>, equipementId: string) {
  const { data: eq } = await supabase.from("equipements").select("site_id").eq("id", equipementId).single();
  if (!eq) return null;
  const { data: site } = await supabase.from("sites_view").select("id, nom, hors_contrat").eq("id", eq.site_id).single();
  if (!site) return null;
  return {
    equipementId,
    siteId: site.id,
    clientNom: site.nom,
    type: (site.hors_contrat ? "hors" : "sous") as "hors" | "sous",
  };
}

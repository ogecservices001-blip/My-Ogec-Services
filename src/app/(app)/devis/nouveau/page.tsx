import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NATURES_DEVIS_SELECTIONNABLES } from "@/lib/devis/constants";
import { ModalEcran } from "@/components/modal-ecran";
import { coutRevientDefaut, remiseDuDevis, type CoutRevient } from "@/lib/devis/pricing";
import { indiceSuivant } from "@/lib/devis/numerotation";
import { chargerDevisAEtablir } from "@/lib/bi/devis-a-etablir";
import { pavesDuDevis, type PaveDevis } from "@/lib/devis/paves";
import { NouveauDevisForm } from "./nouveau-devis-form";

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: Promise<{
    brouillonId?: string;
    reviserId?: string;
    siteId?: string;
    signalement?: string;
  }>;
}) {
  await requireAdminOuAccueil();
  const { brouillonId, reviserId, siteId, signalement } = await searchParams;
  const supabase = await createClient();

  const [{ data: sites }, prefillSite, brouillon, revision] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").order("nom"),
    siteId ? chargerPrefillSite(supabase, siteId) : Promise.resolve(null),
    brouillonId ? chargerBrouillon(supabase, brouillonId) : Promise.resolve(null),
    reviserId ? chargerBrouillon(supabase, reviserId) : Promise.resolve(null),
  ]);
  if (revision) {
    return (
      <ModalEcran titre={`Réviser le devis ${revision.numero}`} hrefFermer={`/devis/${revision.id}/statut`} large>
        <NouveauDevisForm
          sites={(sites ?? []).map((s) => ({ id: s.id, nom: s.nom, site: s.site, horsContrat: s.hors_contrat }))}
          natures={Object.entries(NATURES_DEVIS_SELECTIONNABLES).map(([valeur, label]) => ({ valeur, label }))}
          prefill={null}
          brouillon={revision}
          revision={{ indiceSuivant: indiceSuivant(revision.indiceRevision), commande: revision.commande }}
        />
      </ModalEcran>
    );
  }
  const aEtablir = signalement && siteId ? (await chargerDevisAEtablir([siteId])).find((a) => a.biNumero === signalement) : undefined;
  const pavesSignales: PaveDevis[] = (aEtablir?.entrees ?? []).map((e) => ({
    equipementId: e.equipementId,
    equipementNom: e.equipementNom,
    localisation: e.localisation,
    libelle: e.compteRendu,
    nature: "",
    lignes: [],
  }));
  const prefill = prefillSite
    ? { ...prefillSite, paves: pavesSignales, signalementBi: signalement ?? "", equipementSignale: aEtablir?.equipementNom ?? "" }
    : null;

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
    numero: devis.numero,
    indiceRevision: devis.indice_revision,
    commande: Boolean(devis.date_commande_client) || devis.annule,
    siteId: devis.site_id,
    clientNom: site.nom,
    type: (site.hors_contrat ? "hors" : "sous") as "hors" | "sous",
    paves: pavesDuDevis(devis),
    coutRevient: (devis.cout_revient as unknown as CoutRevient) ?? coutRevientDefaut(),
    remise: remiseDuDevis(devis),
  };
}

async function chargerPrefillSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data: site } = await supabase.from("sites_view").select("id, nom, hors_contrat").eq("id", siteId).single();
  if (!site) return null;
  return {
    siteId: site.id,
    clientNom: site.nom,
    type: (site.hors_contrat ? "hors" : "sous") as "hors" | "sous",
  };
}

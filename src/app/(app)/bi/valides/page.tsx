import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { montantBi, STATUTS_BI_VALIDES as STATUTS_VALIDES } from "@/lib/facturation/ca-facturable";
import { BonsValidesTableau } from "./bons-valides";

export default async function BiValidesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select(
      "id, numero, statut, pole, client_nom, site, equipement_nom, equipement_localisation, updated_at, classement, mois_facturation, site_id, devis_id, temps_passe, nombre_deplacements, prestas, interventions_supplementaires",
    )
    .in("statut", STATUTS_VALIDES)
    .order("updated_at", { ascending: false });

  const siteIds = [...new Set((bons ?? []).map((b) => b.site_id).filter((id): id is string => Boolean(id)))];
  const { data: sites } =
    siteIds.length > 0
      ? await supabase.from("sites").select("id, taux_horaire_regie, forfait_deplacement").in("id", siteIds)
      : { data: [] };
  const tauxParSite = new Map((sites ?? []).map((s) => [s.id, s]));

  // Prestation sur devis : aucun montant ici, le prix est celui du devis.
  const lignes = (bons ?? []).map((b) => ({
    ...b,
    montantHt: montantBi(b, b.site_id ? (tauxParSite.get(b.site_id) ?? null) : null),
  }));

  return <BonsValidesTableau bons={lignes} />;
}

import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Statuts, sansTempsPasse } from "@/lib/bi/constants";
import { montantMainDoeuvre, montantDeplacements, totalHT, type Presta } from "@/lib/bi/format";
import { BonsValidesTableau } from "./bons-valides";

const STATUTS_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

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

  // Pôles sur forfait (prestations sur devis) : le montant est celui du
  // devis lié, pas un calcul à l'heure qui n'a pas de sens pour eux.
  const devisIds = [...new Set((bons ?? []).filter((b) => sansTempsPasse(b.pole) && b.devis_id).map((b) => b.devis_id as string))];
  const { data: devisLies } = devisIds.length > 0 ? await supabase.from("devis").select("id, montant").in("id", devisIds) : { data: [] };
  const montantDevisParId = new Map((devisLies ?? []).map((d) => [d.id, d.montant ?? 0]));

  const lignes = (bons ?? []).map((b) => {
    const taux = b.site_id ? (tauxParSite.get(b.site_id) ?? null) : null;
    const forfait = sansTempsPasse(b.pole);
    const montantHeures = forfait ? 0 : (montantMainDoeuvre(b.temps_passe, taux) ?? 0);
    const montantDepl = forfait ? 0 : (montantDeplacements(b.nombre_deplacements, taux) ?? 0);
    const prestas = [
      ...(b.prestas as unknown as Presta[]),
      ...(b.interventions_supplementaires as unknown as { prestas: Presta[] }[]).flatMap((i) => i.prestas ?? []),
    ];
    const montantDevis = forfait && b.devis_id ? (montantDevisParId.get(b.devis_id) ?? 0) : 0;
    const montantHt = montantDevis + montantHeures + montantDepl + totalHT(prestas);
    return { ...b, montantHt };
  });

  return <BonsValidesTableau bons={lignes} />;
}

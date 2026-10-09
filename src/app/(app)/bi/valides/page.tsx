import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Statuts } from "@/lib/bi/constants";
import { dureeEnHeures, parsePu, totalHT, type Presta } from "@/lib/bi/format";
import { BiValidesOnglets } from "./onglets";

const STATUTS_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

export default async function BiValidesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select(
      "id, numero, statut, pole, client_nom, site, equipement_nom, equipement_localisation, updated_at, classement, mois_facturation, site_id, temps_passe, nombre_deplacements, prestas, interventions_supplementaires",
    )
    .in("statut", STATUTS_VALIDES)
    .order("updated_at", { ascending: false });

  const siteIds = [...new Set((bons ?? []).map((b) => b.site_id).filter((id): id is string => Boolean(id)))];
  const { data: sites } =
    siteIds.length > 0
      ? await supabase.from("sites").select("id, taux_horaire_regie, forfait_deplacement").in("id", siteIds)
      : { data: [] };
  const tauxParSite = new Map((sites ?? []).map((s) => [s.id, s]));

  const lignes = (bons ?? []).map((b) => {
    const taux = b.site_id ? tauxParSite.get(b.site_id) : undefined;
    const heures = dureeEnHeures(b.temps_passe);
    const tauxRegie = parsePu(taux?.taux_horaire_regie ?? "");
    const montantHeures = heures !== null && tauxRegie !== null ? heures * tauxRegie : 0;
    const forfait = parsePu(taux?.forfait_deplacement ?? "");
    const montantDeplacements = forfait !== null ? forfait * b.nombre_deplacements : 0;
    const prestas = [
      ...(b.prestas as unknown as Presta[]),
      ...(b.interventions_supplementaires as unknown as { prestas: Presta[] }[]).flatMap((i) => i.prestas ?? []),
    ];
    const montantHt = montantHeures + montantDeplacements + totalHT(prestas);
    return { ...b, montantHt };
  });

  return <BiValidesOnglets bons={lignes} />;
}

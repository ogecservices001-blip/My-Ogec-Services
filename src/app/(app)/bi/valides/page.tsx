import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Statuts } from "@/lib/bi/constants";
import { BiListe } from "../liste";

const STATUTS_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

export default async function BiValidesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("id, numero, statut, pole, client_nom, site, equipement_nom, equipement_localisation, updated_at")
    .in("statut", STATUTS_VALIDES)
    .order("updated_at", { ascending: false });

  return <BiListe bons={bons ?? []} titre="Bons validés" vide="Aucun bon validé pour l'instant" />;
}

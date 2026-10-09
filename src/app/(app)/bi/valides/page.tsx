import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Statuts } from "@/lib/bi/constants";
import { BiValidesOnglets } from "./onglets";

const STATUTS_VALIDES = [Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye];

export default async function BiValidesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("id, numero, statut, pole, client_nom, site, equipement_nom, equipement_localisation, updated_at, classement")
    .in("statut", STATUTS_VALIDES)
    .order("updated_at", { ascending: false });

  return <BiValidesOnglets bons={bons ?? []} />;
}

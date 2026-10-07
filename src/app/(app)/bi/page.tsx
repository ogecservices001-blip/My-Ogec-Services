import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Statuts } from "@/lib/bi/constants";
import { BiListe } from "./liste";

const STATUTS_A_VERIFIER = [Statuts.brouillon, Statuts.aVerifier, Statuts.erreurSync];

/// Bons pas encore validés par le bureau (brouillon, à vérifier, erreur
/// de synchro) — réservé au bureau (voir sidebar : un technicien ne voit
/// même pas le lien). Un technicien peut encore consulter un BI précis
/// en lecture seule via /bi/[id] si on lui en donne le lien, juste pas
/// cette liste.
export default async function BiPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const { data: bons } = await supabase
    .from("bons_intervention")
    .select("id, numero, statut, pole, client_nom, site, updated_at")
    .in("statut", STATUTS_A_VERIFIER)
    .order("updated_at", { ascending: false });

  return <BiListe bons={bons ?? []} titre="Bon à vérifier" vide="Aucun bon à vérifier pour l'instant" />;
}

import { requireAdminOuAccueil } from "@/lib/auth";
import { chargerLignesPrestations } from "@/lib/prestations/charger-lignes";
import { PrestationsListe } from "../liste";

export default async function PrestationsRealiseesPage() {
  await requireAdminOuAccueil();
  const lignes = await chargerLignesPrestations();

  return <PrestationsListe lignes={lignes} isAdmin vue="realisees" />;
}

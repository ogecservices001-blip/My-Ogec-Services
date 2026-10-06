import { requireAdmin } from "@/lib/auth";
import { chargerLignesPrestations } from "@/lib/prestations/charger-lignes";
import { PrestationsListe } from "../liste";

export default async function PrestationsAnnuleesPage() {
  await requireAdmin();
  const lignes = await chargerLignesPrestations();

  return <PrestationsListe lignes={lignes} isAdmin vue="annulees" />;
}

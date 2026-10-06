import { requireProfile } from "@/lib/auth";
import { chargerLignesPrestations } from "@/lib/prestations/charger-lignes";
import { PrestationsListe } from "./liste";

export default async function PrestationsPage() {
  const profile = await requireProfile();
  const lignes = await chargerLignesPrestations();

  return <PrestationsListe lignes={lignes} isAdmin={profile.role === "admin"} vue="a_realiser" />;
}

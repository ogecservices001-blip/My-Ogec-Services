import { requireAdminOuAccueil } from "@/lib/auth";
import { ConsultationCerfa } from "../consultation";
import { chargerSitesConsultation } from "../sites";

export default async function EnvoyerCerfaPage() {
  await requireAdminOuAccueil();
  return <ConsultationCerfa sites={await chargerSitesConsultation()} mode="envoyer" />;
}

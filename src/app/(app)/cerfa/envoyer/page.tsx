import { requireAdminOuAccueil } from "@/lib/auth";
import { ConsultationCerfa } from "../consultation";
import { chargerSitesConsultation } from "../sites";

export default async function EnvoyerCerfaPage({ searchParams }: { searchParams: Promise<{ horsContrat?: string }> }) {
  await requireAdminOuAccueil();
  const horsContrat = (await searchParams).horsContrat === "1";
  return (
    <ConsultationCerfa
      key={horsContrat ? "hors-contrat" : "sous-contrat"}
      sites={await chargerSitesConsultation(horsContrat)}
      mode="envoyer"
      horsContrat={horsContrat}
      base="/cerfa/envoyer"
    />
  );
}

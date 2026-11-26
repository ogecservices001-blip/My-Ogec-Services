import { requireProfile } from "@/lib/auth";
import { ConsultationCerfa } from "../consultation";
import { chargerSitesConsultation } from "../sites";

export default async function VisualiserEquipementCerfaPage({ searchParams }: { searchParams: Promise<{ horsContrat?: string }> }) {
  await requireProfile();
  const horsContrat = (await searchParams).horsContrat === "1";
  return (
    <ConsultationCerfa
      key={horsContrat ? "hors-contrat" : "sous-contrat"}
      sites={await chargerSitesConsultation(horsContrat)}
      mode="equipement"
      horsContrat={horsContrat}
      base="/cerfa/equipement"
    />
  );
}

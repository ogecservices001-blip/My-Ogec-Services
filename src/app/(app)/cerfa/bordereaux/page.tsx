import { requireProfile } from "@/lib/auth";
import { ConsultationCerfa } from "../consultation";
import { chargerSitesConsultation } from "../sites";

export default async function VisualiserBordereauCerfaPage() {
  await requireProfile();
  return <ConsultationCerfa sites={await chargerSitesConsultation()} mode="bordereau" />;
}

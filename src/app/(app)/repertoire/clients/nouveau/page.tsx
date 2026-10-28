import { requireAdminOuAccueil } from "@/lib/auth";
import { ModalEcran } from "@/components/modal-ecran";
import { SiteForm } from "../site-form";

export default async function NouveauSitePage() {
  await requireAdminOuAccueil();

  return (
    <ModalEcran titre="Nouveau site" hrefFermer="/repertoire/clients" large>
      <SiteForm />
    </ModalEcran>
  );
}

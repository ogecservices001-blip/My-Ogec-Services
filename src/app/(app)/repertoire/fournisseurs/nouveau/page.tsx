import { requireAdminOuAccueil } from "@/lib/auth";
import { ModalEcran } from "@/components/modal-ecran";
import { FournisseurForm } from "../fournisseur-form";

export default async function NouveauFournisseurPage() {
  await requireAdminOuAccueil();

  return (
    <ModalEcran titre="Nouveau fournisseur" hrefFermer="/repertoire/fournisseurs" large>
      <FournisseurForm />
    </ModalEcran>
  );
}

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalEcran } from "@/components/modal-ecran";
import { NouvelleCommandeForm } from "../nouveau/nouvelle-commande-form";

/// Commande de consommables d'entretien pour le stock : même formulaire que
/// la commande affaire, sans devis.
export default async function NouvelleCommandeConsommablesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: fournisseurs } = await supabase.from("fournisseurs").select("*").order("nom");

  return (
    <ModalEcran titre="Nouvelle commande consommables" hrefFermer="/commandes-fournisseur" large>
      <NouvelleCommandeForm devis={null} site={null} fournisseurs={fournisseurs ?? []} />
    </ModalEcran>
  );
}

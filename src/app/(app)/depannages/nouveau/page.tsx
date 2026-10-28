import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalEcran } from "@/components/modal-ecran";
import { NouveauDepannageForm } from "./nouveau-form";

export default async function NouveauDepannagePage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: sites }, { data: techniciens }] = await Promise.all([
    supabase
      .from("sites_view")
      .select("id, nom, site, n_affaire, courriel_interlocuteur_site, courriel_responsable, hors_contrat")
      .order("nom"),
    supabase.from("profiles").select("id, name, portable").in("role", ["technicien", "en_attente"]).order("name"),
  ]);

  return (
    <ModalEcran titre="Créer un dépannage" hrefFermer="/depannages" large>
      <NouveauDepannageForm sites={sites ?? []} techniciens={techniciens ?? []} />
    </ModalEcran>
  );
}

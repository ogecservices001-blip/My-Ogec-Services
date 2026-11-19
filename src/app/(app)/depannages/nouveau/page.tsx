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
      .select("id, nom, site, n_affaire, courriel_interlocuteur_site, courriel_responsable, responsable_contrat, hors_contrat, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site, interlocuteur_site_2, tel_fixe_interlocuteur_site_2, portable_interlocuteur_site_2, courriel_interlocuteur_site_2, interlocuteur_site_3, tel_fixe_interlocuteur_site_3, portable_interlocuteur_site_3, courriel_interlocuteur_site_3, interlocuteur_site_4, tel_fixe_interlocuteur_site_4, portable_interlocuteur_site_4, courriel_interlocuteur_site_4")
      .order("nom"),
    supabase.from("profiles").select("id, name, portable").in("role", ["technicien", "en_attente"]).order("name"),
  ]);

  return (
    <ModalEcran titre="Créer un dépannage" hrefFermer="/depannages" large>
      <NouveauDepannageForm sites={sites ?? []} techniciens={techniciens ?? []} />
    </ModalEcran>
  );
}

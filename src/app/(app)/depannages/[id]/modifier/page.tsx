import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModalEcran } from "@/components/modal-ecran";
import { NouveauDepannageForm } from "../../nouveau/nouveau-form";

export default async function ModifierDepannagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: demande }, { data: sites }, { data: techniciens }] = await Promise.all([
    supabase.from("demandes_depannage").select("*").eq("id", id).single(),
    supabase
      .from("sites_view")
      .select("id, nom, site, n_affaire, courriel_interlocuteur_site, courriel_responsable, responsable_contrat, hors_contrat, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site, interlocuteur_site_2, tel_fixe_interlocuteur_site_2, portable_interlocuteur_site_2, courriel_interlocuteur_site_2, interlocuteur_site_3, tel_fixe_interlocuteur_site_3, portable_interlocuteur_site_3, courriel_interlocuteur_site_3, interlocuteur_site_4, tel_fixe_interlocuteur_site_4, portable_interlocuteur_site_4, courriel_interlocuteur_site_4")
      .order("nom"),
    supabase.from("profiles").select("id, name, portable").in("role", ["technicien", "en_attente"]).order("name"),
  ]);
  if (!demande) notFound();

  const site = demande.site_id ? (sites ?? []).find((s) => s.id === demande.site_id) : undefined;

  return (
    <ModalEcran titre={`Modifier le dépannage N°${demande.numero}`} hrefFermer="/depannages" large>
      <NouveauDepannageForm
        sites={sites ?? []}
        techniciens={techniciens ?? []}
        idDepannage={demande.id}
        initial={{
          horsContrat: site?.hors_contrat ?? false,
          clientNom: demande.client_nom,
          siteId: demande.site_id ?? "",
          equipementId: demande.equipement_id ?? "",
          message: demande.message,
          lieuPanne: demande.lieu_panne,
          numeroDemandeClient: demande.numero_demande_client,
          email: demande.email,
          intervenantId: demande.intervenant_id ?? "",
          dateInterventionPrevue: demande.date_intervention_prevue ?? "",
          emailDejaEnvoye: Boolean(demande.email_prise_en_compte_envoye_le),
        }}
      />
    </ModalEcran>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Tables } from "@/lib/types";
import { DepannagesListe } from "./depannages-liste";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";

export default async function DepannagesPage() {
  const supabase = await createClient();
  const [{ data }, { data: techniciens }, profile, devisEnCours, { data: brouillonsBi }] = await Promise.all([
    supabase.from("demandes_depannage").select("*").order("date_creation", { ascending: false }),
    supabase.from("profiles").select("id, name, portable"),
    getCurrentProfile(),
    chargerDevisEnCoursParEquipement(),
    // Brouillons BI déjà enregistrés pour un dépannage — pour proposer
    // "Reprendre le BI" plutôt que d'en recréer un (voir wizard.tsx).
    supabase.from("bons_intervention").select("id, depannage_id").eq("statut", "brouillon").not("depannage_id", "is", null),
  ]);
  const brouillonBiParDepannageId: Record<string, string> = {};
  for (const b of brouillonsBi ?? []) {
    if (b.depannage_id) brouillonBiParDepannageId[b.depannage_id] = b.id;
  }

  const techniciensParId: Record<string, { name: string; portable: string }> = {};
  for (const t of techniciens ?? []) techniciensParId[t.id] = { name: t.name, portable: t.portable };

  const siteIds = [...new Set((data ?? []).map((d) => d.site_id).filter((id): id is string => Boolean(id)))];
  const { data: sites } = await supabase
    .from("sites")
    .select("id, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site")
    .in("id", siteIds);
  const contactsParSite: Record<string, { nom: string; tel: string }> = {};
  for (const s of sites ?? []) {
    contactsParSite[s.id] = {
      nom: s.interlocuteur_site,
      tel: s.portable_interlocuteur_site || s.tel_fixe_interlocuteur_site,
    };
  }

  return (
    <DepannagesListe
      demandes={(data ?? []) as Tables<"demandes_depannage">[]}
      techniciensParId={techniciensParId}
      contactsParSite={contactsParSite}
      isAdmin={profile?.role === "admin"}
      vue="en_cours"
      devisEnCours={devisEnCours}
      brouillonBiParDepannageId={brouillonBiParDepannageId}
    />
  );
}

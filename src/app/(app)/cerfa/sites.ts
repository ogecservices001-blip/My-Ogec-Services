import { createClient } from "@/lib/supabase/server";
import type { SiteConsultation } from "./consultation";

const COLONNES =
  "id, nom, site, n_affaire, adresse, complement_adresse, code_postal, commune, interlocuteur_site, qualite_interlocuteur_site, courriel_interlocuteur_site, interlocuteur_site_2, qualite_interlocuteur_site_2, courriel_interlocuteur_site_2, interlocuteur_site_3, qualite_interlocuteur_site_3, courriel_interlocuteur_site_3, interlocuteur_site_4, qualite_interlocuteur_site_4, courriel_interlocuteur_site_4";

type SiteBrut = Record<string, string>;

export function signatairesSite(s: SiteBrut): { nom: string; qualite: string; email: string }[] {
  return ["", "_2", "_3", "_4"]
    .map((suf) => ({
      nom: s[`interlocuteur_site${suf}`] ?? "",
      qualite: s[`qualite_interlocuteur_site${suf}`] ?? "",
      email: s[`courriel_interlocuteur_site${suf}`] ?? "",
    }))
    .filter((x) => x.nom.trim());
}

export async function chargerSitesConsultation(horsContrat?: boolean): Promise<SiteConsultation[]> {
  const supabase = await createClient();
  let requete = supabase.from("sites_view").select(COLONNES).order("nom");
  if (horsContrat !== undefined) requete = requete.eq("hors_contrat", horsContrat);
  const { data } = await requete;
  return ((data ?? []) as unknown as SiteBrut[]).map((s) => ({
    id: s.id,
    nom: s.nom,
    site: s.site,
    n_affaire: s.n_affaire,
    adresse: s.adresse,
    complement_adresse: s.complement_adresse,
    code_postal: s.code_postal,
    commune: s.commune,
    signataires: signatairesSite(s),
  }));
}

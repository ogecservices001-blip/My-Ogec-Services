import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { requireAdmin } from "@/lib/auth";
import type { Site } from "@/lib/types";
import { ChronoDevis } from "./chrono-devis";
import type { DevisRegistreLigne } from "./registre-liste";
import { STATUTS_BI_REALISE } from "./statut";

/// Tous les devis, tous clients confondus (sous ET hors contrat) —
/// contrairement à /devis/par-client, Chrono Devis n'a pas de filtre
/// contrat : c'est le registre complet, point.
export default async function DevisChronoPage() {
  await requireAdmin();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: sites }, { data: devis }, { data: bons }] = await Promise.all([
    supabase.from("sites_view").select("*"),
    supabase.from("devis").select("*"),
    supabase.from("bons_intervention").select("devis_id, statut"),
  ]);

  const siteParId = new Map(((sites ?? []) as Site[]).map((s) => [s.id, s]));
  const devisRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id as string),
  );

  // Registre chrono : tous les devis, à plat, du plus récent au plus
  // ancien (created_at, fiable contrairement à date_devis saisi en
  // texte libre côté import).
  const registre: DevisRegistreLigne[] = (devis ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((d) => {
      const site = siteParId.get(d.site_id);
      return {
        id: d.id,
        numero: d.numero,
        clientNom: site?.nom ?? "",
        clientSite: site?.site ?? "",
        libelle: d.libelle,
        nature: d.nature,
        montant: d.montant,
        dateDevis: d.date_devis,
        commande: Boolean(d.date_commande_client),
        // Un BI réellement créé dans l'appli, ou une référence BI
        // historique (classeur pré-appli, sans vrai bon en base) —
        // même règle que Prestation sur commande.
        realise: devisRealises.has(d.id) || Boolean(d.bi_reference_historique),
        annule: d.annule,
      };
    });

  return <ChronoDevis registre={registre} isAdmin={profile?.role === "admin"} />;
}

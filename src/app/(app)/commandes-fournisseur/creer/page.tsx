import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUTS_BI_REALISE, calculerStatutDevis } from "../../devis/statut";
import { CreerCommandeListe, type DevisValide } from "./liste";

/// Point d'entrée "Créer une commande" du menu Commande fournisseur —
/// liste les devis au statut "Commandé" (matériel encore à commander),
/// pour en choisir un à partir duquel créer la commande, en plus du
/// bouton déjà présent sur la fiche devis elle-même. Une fois réalisé
/// ou facturable, plus besoin de passer commande.
export default async function CreerCommandePage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const [{ data: devis }, { data: bons }] = await Promise.all([
    supabase
      .from("devis")
      .select("id, numero, site_id, libelle, date_commande_client, annule, bi_reference_historique, mois_facturation"),
    supabase.from("bons_intervention").select("devis_id, statut"),
  ]);

  const realises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id as string),
  );

  const valides = (devis ?? []).filter((d) => {
    const statut = calculerStatutDevis({
      annule: d.annule,
      commande: Boolean(d.date_commande_client),
      realise: realises.has(d.id) || Boolean(d.bi_reference_historique),
      facturable: Boolean(d.mois_facturation),
    });
    return statut === "commande";
  });

  const sitesIds = [...new Set(valides.map((d) => d.site_id))];
  const { data: sites } = sitesIds.length > 0 ? await supabase.from("sites").select("id, nom, site").in("id", sitesIds) : { data: [] };
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));

  const lignes: DevisValide[] = valides
    .sort((a, b) => b.numero.localeCompare(a.numero))
    .map((d) => {
      const site = siteParId.get(d.site_id);
      return {
        id: d.id,
        numero: d.numero,
        clientNom: [site?.nom, site?.site].filter(Boolean).join(" — "),
        libelle: d.libelle,
      };
    });

  return <CreerCommandeListe devis={lignes} />;
}

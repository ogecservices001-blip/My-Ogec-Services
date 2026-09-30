import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrestationsListe, type PrestationLigne } from "./liste";

const STATUTS_REALISE = new Set(["valide", "pdf", "prete", "envoye"]);

export default async function PrestationsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: devis }, { data: bons }, { data: sites }] = await Promise.all([
    supabase.from("devis").select("*").neq("date_commande_client", ""),
    supabase.from("bons_intervention").select("id, devis_id, numero, statut"),
    supabase.from("sites").select("id, nom, site"),
  ]);

  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const bonParDevisId = new Map<string, { numero: string; statut: string }>();
  for (const b of bons ?? []) {
    if (!b.devis_id) continue;
    // Un devis peut en théorie avoir plusieurs BI (reprise après
    // erreur) — le plus avancé (réalisé) prime sur un brouillon.
    const existant = bonParDevisId.get(b.devis_id);
    if (!existant || (STATUTS_REALISE.has(b.statut) && !STATUTS_REALISE.has(existant.statut))) {
      bonParDevisId.set(b.devis_id, { numero: b.numero, statut: b.statut });
    }
  }

  const lignes: PrestationLigne[] = (devis ?? []).map((d) => {
    const site = siteParId.get(d.site_id);
    const bon = bonParDevisId.get(d.id);
    return {
      id: d.id,
      numero: d.numero,
      clientNom: site?.nom ?? "",
      clientSite: site?.site ?? "",
      nature: d.nature,
      libelle: d.libelle,
      montant: d.montant,
      heuresPrevues: d.heures_prevues,
      dateCommandeClient: d.date_commande_client,
      biNumero: bon?.numero ?? null,
      realisee: bon ? STATUTS_REALISE.has(bon.statut) : false,
    };
  });

  return <PrestationsListe lignes={lignes} />;
}

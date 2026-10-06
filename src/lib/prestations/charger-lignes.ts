import { createClient } from "@/lib/supabase/server";
import { Statuts } from "@/lib/bi/constants";

export type PrestationLigne = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  nature: string;
  libelle: string;
  montant: number | null;
  heuresPrevues: number | null;
  dateCommandeClient: string;
  biId: string | null;
  biNumero: string | null;
  realisee: boolean;
  annulee: boolean;
};

// Comme pour un dépannage : dès que le technicien a transmis le BI
// (statut différent de brouillon), la prestation est considérée
// réalisée — le reste du workflow (vérif bureau, facturation) ne
// concerne plus le suivi "à réaliser / réalisées".
const STATUTS_REALISE = new Set<string>(
  Object.values(Statuts).filter((s) => s !== Statuts.brouillon),
);

export async function chargerLignesPrestations(): Promise<PrestationLigne[]> {
  const supabase = await createClient();

  const [{ data: devis }, { data: bons }, { data: sites }] = await Promise.all([
    supabase.from("devis").select("*").neq("date_commande_client", ""),
    supabase.from("bons_intervention").select("id, devis_id, numero, statut"),
    supabase.from("sites").select("id, nom, site"),
  ]);

  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const bonParDevisId = new Map<string, { id: string; numero: string; statut: string }>();
  for (const b of bons ?? []) {
    if (!b.devis_id) continue;
    // Un devis peut en théorie avoir plusieurs BI (reprise après
    // erreur) — le plus avancé (réalisé) prime sur un brouillon.
    const existant = bonParDevisId.get(b.devis_id);
    if (!existant || (STATUTS_REALISE.has(b.statut) && !STATUTS_REALISE.has(existant.statut))) {
      bonParDevisId.set(b.devis_id, { id: b.id, numero: b.numero, statut: b.statut });
    }
  }

  return (devis ?? []).map((d) => {
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
      biId: bon?.id ?? null,
      biNumero: bon?.numero ?? d.bi_reference_historique ?? null,
      realisee: (bon ? STATUTS_REALISE.has(bon.statut) : false) || Boolean(d.bi_reference_historique),
      annulee: d.annule,
    };
  });
}

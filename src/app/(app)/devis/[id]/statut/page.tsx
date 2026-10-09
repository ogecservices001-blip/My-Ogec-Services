import { notFound } from "next/navigation";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Site, Tables } from "@/lib/types";
import { sommeDurees } from "@/lib/bi/format";
import { calculerTotaux, type LigneCommande } from "@/lib/commandes-fournisseur/format";
import { STATUTS_BI_REALISE } from "../../statut";
import { StatutDevisForm } from "./statut-form";

export default async function StatutDevisPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOuAccueil();
  const { id } = await params;

  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("*").eq("id", id).single();
  if (!devis) notFound();

  const [{ data: site }, { data: bons }, { data: equipements }, { data: commandes }] = await Promise.all([
    supabase.from("sites").select("nom, site").eq("id", devis.site_id).single(),
    supabase
      .from("bons_intervention")
      .select("statut, date_intervention, date_debut, date_fin, temps_passe")
      .eq("devis_id", id),
    supabase.from("equipements").select("id, nom, numero_equipement").eq("site_id", devis.site_id).order("nom"),
    supabase
      .from("commandes_fournisseur")
      .select("id, numero, fournisseur_id, lignes, taux_tva")
      .eq("devis_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const bonsRealises = (bons ?? []).filter((b) => STATUTS_BI_REALISE.has(b.statut));
  const realise = bonsRealises.length > 0 || Boolean(devis.bi_reference_historique);

  // Une seule date d'exécution a du sens à l'affichage : la plus
  // récente intervention réalisée (date_intervention sinon date_fin/
  // date_debut pour les pôles à période).
  const datesExecution = bonsRealises
    .map((b) => b.date_intervention || b.date_fin || b.date_debut)
    .filter(Boolean)
    .sort();
  const dateExecution = datesExecution[datesExecution.length - 1] ?? "";
  const heuresExecutees = sommeDurees(bonsRealises.map((b) => b.temps_passe));

  const fournisseurIds = [...new Set((commandes ?? []).map((c) => c.fournisseur_id))];
  const { data: fournisseurs } =
    fournisseurIds.length > 0
      ? await supabase.from("fournisseurs").select("id, nom").in("id", fournisseurIds)
      : { data: [] };
  const fournisseurParId = new Map((fournisseurs ?? []).map((f) => [f.id, f.nom]));
  const commandesFournisseur = (commandes ?? []).map((c) => ({
    id: c.id,
    numero: c.numero,
    fournisseurNom: fournisseurParId.get(c.fournisseur_id) ?? "",
    montantTtc: calculerTotaux((c.lignes as unknown as LigneCommande[]) ?? [], c.taux_tva).ttc,
  }));

  return (
    <StatutDevisForm
      devis={devis as Tables<"devis">}
      site={site as Pick<Site, "nom" | "site"> | null}
      realise={realise}
      equipements={equipements ?? []}
      commandesFournisseur={commandesFournisseur}
      dateExecution={dateExecution}
      heuresExecutees={heuresExecutees}
    />
  );
}

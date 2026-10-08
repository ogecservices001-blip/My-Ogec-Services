import { notFound } from "next/navigation";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Site, Tables } from "@/lib/types";
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
    supabase.from("bons_intervention").select("statut").eq("devis_id", id),
    supabase.from("equipements").select("id, nom, numero_equipement").eq("site_id", devis.site_id).order("nom"),
    supabase
      .from("commandes_fournisseur")
      .select("id, numero, fournisseur_id")
      .eq("devis_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const realise = (bons ?? []).some((b) => STATUTS_BI_REALISE.has(b.statut)) || Boolean(devis.bi_reference_historique);

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
  }));

  return (
    <StatutDevisForm
      devis={devis as Tables<"devis">}
      site={site as Pick<Site, "nom" | "site"> | null}
      realise={realise}
      equipements={equipements ?? []}
      commandesFournisseur={commandesFournisseur}
    />
  );
}

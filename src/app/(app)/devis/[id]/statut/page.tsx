import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Site, Tables } from "@/lib/types";
import { STATUTS_BI_REALISE } from "../../statut";
import { StatutDevisForm } from "./statut-form";

export default async function StatutDevisPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("*").eq("id", id).single();
  if (!devis) notFound();

  const [{ data: site }, { data: bons }] = await Promise.all([
    supabase.from("sites").select("nom, site").eq("id", devis.site_id).single(),
    supabase.from("bons_intervention").select("statut").eq("devis_id", id),
  ]);
  const realise = (bons ?? []).some((b) => STATUTS_BI_REALISE.has(b.statut)) || Boolean(devis.bi_reference_historique);

  return (
    <StatutDevisForm
      devis={devis as Tables<"devis">}
      site={site as Pick<Site, "nom" | "site"> | null}
      realise={realise}
    />
  );
}

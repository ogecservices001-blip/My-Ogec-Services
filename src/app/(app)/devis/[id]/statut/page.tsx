import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Site, Tables } from "@/lib/types";
import { StatutDevisForm } from "./statut-form";

export default async function StatutDevisPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("*").eq("id", id).single();
  if (!devis) notFound();

  const { data: site } = await supabase
    .from("sites")
    .select("nom, site")
    .eq("id", devis.site_id)
    .single();

  return <StatutDevisForm devis={devis as Tables<"devis">} site={site as Pick<Site, "nom" | "site"> | null} />;
}

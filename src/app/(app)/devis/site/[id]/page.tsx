import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site } from "@/lib/types";
import { DevisDuSite } from "./devis-liste";

export default async function DevisSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: s } = await supabase.from("sites_view").select("*").eq("id", id).single();
  if (!s) notFound();
  const site = s as Site;

  const { data: devis } = await supabase
    .from("devis")
    .select("*")
    .eq("site_id", id)
    .order("created_at", { ascending: false });

  return <DevisDuSite site={site} devis={devis ?? []} isAdmin={profile?.role === "admin"} />;
}

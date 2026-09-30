import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site } from "@/lib/types";
import { AffairesDuSite } from "./affaires-liste";

export default async function AffairesSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: s } = await supabase.from("sites_view").select("*").eq("id", id).single();
  if (!s) notFound();
  const site = s as Site;

  const { data: affaires } = await supabase
    .from("affaires")
    .select("*")
    .eq("site_id", id)
    .order("created_at", { ascending: false });

  return (
    <AffairesDuSite
      site={site}
      affaires={affaires ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}

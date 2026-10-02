import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Signalement, SignalementHistorique } from "@/lib/types";
import { DetailSignalement } from "./detail";

export default async function SignalementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: signalement }, { data: journal }] = await Promise.all([
    supabase.from("signalements").select("*").eq("id", id).single(),
    supabase
      .from("signalements_historique")
      .select("*")
      .eq("signalement_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!signalement) notFound();

  return (
    <DetailSignalement
      signalement={signalement as Signalement}
      journal={(journal ?? []) as SignalementHistorique[]}
    />
  );
}

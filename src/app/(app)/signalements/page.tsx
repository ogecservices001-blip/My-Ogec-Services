import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Signalement } from "@/lib/types";
import { SignalementsEcran } from "./ecran";

export default async function SignalementsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";

  let signalements: Signalement[] = [];
  if (isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("signalements")
      .select("*")
      .order("created_at", { ascending: false });
    signalements = data ?? [];
  }

  return <SignalementsEcran isAdmin={isAdmin} signalements={signalements} />;
}

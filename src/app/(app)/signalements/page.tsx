import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { construireModules } from "@/lib/menus";
import type { Signalement } from "@/lib/types";
import { SignalementsEcran, type HistoriqueParSignalement } from "./ecran";

export default async function SignalementsPage() {
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const modules = construireModules(isAdmin);

  let signalements: Signalement[] = [];
  const historique: HistoriqueParSignalement = {};
  if (isAdmin) {
    const supabase = await createClient();
    const [{ data: sData }, { data: hData }] = await Promise.all([
      supabase.from("signalements").select("*").order("created_at", { ascending: false }),
      supabase.from("signalements_historique").select("*").order("created_at", { ascending: true }),
    ]);
    signalements = sData ?? [];
    for (const h of hData ?? []) {
      (historique[h.signalement_id] ??= []).push(h);
    }
  }

  return (
    <SignalementsEcran
      isAdmin={isAdmin}
      modules={modules}
      signalements={signalements}
      historique={historique}
    />
  );
}

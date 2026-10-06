import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { ReferenceHoraire } from "@/lib/gmao/types";
import { HeuresArbre } from "./heures-arbre";

export default async function ReferencesHorairesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data } = await supabase.from("references_horaires").select("*").order("designation");

  return (
    <HeuresArbre
      references={(data as ReferenceHoraire[]) ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}

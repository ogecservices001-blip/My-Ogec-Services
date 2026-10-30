import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { ReferenceHoraire } from "@/lib/gmao/types";
import { HeuresListe } from "./heures-liste";

export default async function ReferencesHorairesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data } = await supabase.from("references_horaires").select("*").order("designation");

  return (
    <HeuresListe
      references={(data as ReferenceHoraire[]) ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}

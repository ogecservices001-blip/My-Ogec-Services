import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Profil } from "@/lib/types";
import { CollaborateursListe } from "./collaborateurs-liste";

export default async function CollaborateursPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data } = await supabase.from("profiles").select("*").order("name");

  return (
    <CollaborateursListe
      profils={(data as Profil[]) ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Fournisseur } from "@/lib/types";
import { FournisseursListe } from "./fournisseurs-liste";

export default async function FournisseursListePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data } = await supabase.from("fournisseurs").select("*").order("nom");

  return (
    <FournisseursListe
      fournisseurs={(data as Fournisseur[]) ?? []}
      isAdmin={profile?.role === "admin"}
    />
  );
}

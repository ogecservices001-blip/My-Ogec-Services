import { requireAdminOuAccueil } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { TypeEquipement } from "@/lib/gmao/types";
import { FamillesListe } from "./familles-liste";

export default async function FamillesListePage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const [{ data }, profile] = await Promise.all([
    supabase.from("types_equipement").select("*").order("nom"),
    getCurrentProfile(),
  ]);

  return <FamillesListe familles={(data as TypeEquipement[]) ?? []} isAdmin={profile?.role === "admin"} />;
}

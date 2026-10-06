import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TypeEquipement } from "@/lib/gmao/types";
import { FamillesListe } from "./familles-liste";

export default async function FamillesListePage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const { data } = await supabase.from("types_equipement").select("*").order("nom");

  return <FamillesListe familles={(data as TypeEquipement[]) ?? []} />;
}

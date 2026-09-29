import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site } from "@/lib/types";
import { ClientsListe } from "./clients-liste";

export default async function ClientsListePage({
  searchParams,
}: {
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data } = await supabase
    .from("sites_view")
    .select("*")
    .eq("hors_contrat", horsContrat)
    .order("nom");

  return (
    <ClientsListe
      sites={(data as Site[]) ?? []}
      horsContrat={horsContrat}
      isAdmin={profile?.role === "admin"}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Tables } from "@/lib/types";
import { DepannagesListe } from "./depannages-liste";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";

export default async function DepannagesPage() {
  const supabase = await createClient();
  const [{ data }, { data: techniciens }, profile, devisEnCours] = await Promise.all([
    supabase.from("demandes_depannage").select("*").order("date_creation", { ascending: false }),
    supabase.from("profiles").select("id, name, portable"),
    getCurrentProfile(),
    chargerDevisEnCoursParEquipement(),
  ]);

  const techniciensParId: Record<string, { name: string; portable: string }> = {};
  for (const t of techniciens ?? []) techniciensParId[t.id] = { name: t.name, portable: t.portable };

  return (
    <DepannagesListe
      demandes={(data ?? []) as Tables<"demandes_depannage">[]}
      techniciensParId={techniciensParId}
      isAdmin={profile?.role === "admin"}
      vue="en_cours"
      devisEnCours={devisEnCours}
    />
  );
}

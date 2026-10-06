import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types";
import { DepannagesListe } from "../depannages-liste";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";

export default async function DepannagesTraiteesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: techniciens }, devisEnCours] = await Promise.all([
    supabase.from("demandes_depannage").select("*").order("date_creation", { ascending: false }),
    supabase.from("profiles").select("id, name, portable"),
    chargerDevisEnCoursParEquipement(),
  ]);

  const techniciensParId: Record<string, { name: string; portable: string }> = {};
  for (const t of techniciens ?? []) techniciensParId[t.id] = { name: t.name, portable: t.portable };

  return (
    <DepannagesListe
      demandes={(data ?? []) as Tables<"demandes_depannage">[]}
      techniciensParId={techniciensParId}
      isAdmin
      vue="traitees"
      devisEnCours={devisEnCours}
    />
  );
}

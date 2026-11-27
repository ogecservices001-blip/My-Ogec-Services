import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types";
import { StatistiquesTab } from "../statistiques";
import { chargerDepannagesEquipements } from "@/lib/gmao/recurrence-depannages";

export default async function DepannagesStatistiquesPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const [{ data }, { data: techniciens }, depannagesEquipements] = await Promise.all([
    supabase.from("demandes_depannage").select("*").order("date_creation", { ascending: false }),
    supabase.from("profiles").select("id, name, portable"),
    chargerDepannagesEquipements(supabase),
  ]);

  const techniciensParId: Record<string, { name: string; portable: string }> = {};
  for (const t of techniciens ?? []) techniciensParId[t.id] = { name: t.name, portable: t.portable };

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">Statistiques dépannages</h1>
      <StatistiquesTab
        demandes={(data ?? []) as Tables<"demandes_depannage">[]}
        techniciensParId={techniciensParId}
        depannagesEquipements={depannagesEquipements}
      />
    </div>
  );
}

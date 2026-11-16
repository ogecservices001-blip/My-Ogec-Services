import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ParametresForm } from "./parametres-form";

export default async function ParametresPaiePage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("rh_parametres").select("*").eq("id", 1).single();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Paramètres de paie</h1>
      <p className="mb-5 text-sm text-slate-500">Règles de calcul du pointage : heures supplémentaires, panier, horaires journaliers.</p>
      {data ? <ParametresForm valeurs={data} /> : <p className="text-sm text-red-600">Paramètres introuvables.</p>}
    </div>
  );
}

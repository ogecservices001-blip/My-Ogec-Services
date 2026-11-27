import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chargerCaFacturable } from "@/lib/facturation/ca-facturable";
import { VueCaFacturable } from "./vue";

export default async function CaFacturablePage() {
  await requireAdmin();
  const supabase = await createClient();
  const lignes = await chargerCaFacturable(supabase);
  return <VueCaFacturable lignes={lignes} />;
}

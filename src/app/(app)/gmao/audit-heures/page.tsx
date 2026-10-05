import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculerLignesAuditHeures } from "./calcul";
import { AuditHeuresTableau } from "./tableau";

export default async function AuditHeuresPage() {
  await requireAdmin();
  const supabase = await createClient();
  const lignes = await calculerLignesAuditHeures(supabase);

  return <AuditHeuresTableau lignes={lignes} />;
}

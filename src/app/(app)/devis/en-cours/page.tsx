import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import type { Site } from "@/lib/types";
import { DevisEntete } from "../entete";
import { DevisEnCoursListe } from "./liste";

export default async function DevisEnCoursPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const [{ data: devis }, { data: sites }] = await Promise.all([
    supabase.from("devis").select("*").eq("numero", "").order("updated_at", { ascending: false }),
    supabase.from("sites_view").select("*"),
  ]);
  const siteParId = new Map(((sites ?? []) as Site[]).map((s) => [s.id, s]));

  return (
    <div>
      <DevisEntete isAdmin />
      <p className="mb-5 text-sm text-slate-500">
        Devis enregistrés incomplets depuis &quot;Nouveau devis&quot; — pas encore de numéro officiel attribué.
      </p>
      <DevisEnCoursListe
        devis={(devis ?? []).map((d) => {
          const site = siteParId.get(d.site_id);
          return { id: d.id, client: site?.nom ?? "", site: site?.site ?? "", libelle: d.libelle, redacteur: d.redacteur };
        })}
      />
    </div>
  );
}

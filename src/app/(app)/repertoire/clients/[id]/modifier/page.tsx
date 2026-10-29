import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { FilAjouter } from "@/components/fil-extra-context";
import type { Site } from "@/lib/types";
import { SiteForm } from "../../site-form";

export default async function ModifierSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOuAccueil();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("sites_view").select("*").eq("id", id).single();
  if (!data) notFound();
  const site = data as Site;

  return (
    <div>
      <FilAjouter
        maillons={[
          { nom: site.nom, href: `/repertoire/clients/groupe/${encodeURIComponent(site.nom)}?horsContrat=${site.hors_contrat ? 1 : 0}` },
          { nom: site.site || "Site sans nom", href: `/repertoire/clients/${id}` },
          { nom: "Modifier" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {site.nom}
      </h1>
      <p className="mb-5 text-lg font-semibold text-blue-600">{site.site}</p>
      <SiteForm site={site} />
    </div>
  );
}

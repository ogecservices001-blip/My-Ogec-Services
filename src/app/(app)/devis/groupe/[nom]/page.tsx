import Link from "next/link";
import { ArrowLeft, ChevronRight, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Site } from "@/lib/types";

export default async function DevisSitesDuClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ nom: string }>;
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();

  const { data } = await supabase
    .from("sites_view")
    .select("*")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat)
    .order("site");
  const sites = (data as Site[]) ?? [];

  const { data: devis } = await supabase
    .from("devis")
    .select("site_id, date_commande_client")
    .in("site_id", sites.map((s) => s.id));
  const nbParSite = new Map<string, number>();
  const nbCommandesParSite = new Map<string, number>();
  for (const d of devis ?? []) {
    nbParSite.set(d.site_id, (nbParSite.get(d.site_id) ?? 0) + 1);
    if (d.date_commande_client) nbCommandesParSite.set(d.site_id, (nbCommandesParSite.get(d.site_id) ?? 0) + 1);
  }
  const sitesAvecDevis = sites.filter((s) => (nbParSite.get(s.id) ?? 0) > 0);

  return (
    <div>
      <Link
        href={`/devis?horsContrat=${horsContrat ? "1" : "0"}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{nomDecode}</h1>
      <p className="mb-5 text-sm text-slate-500">{sitesAvecDevis.length} site(s)</p>

      <ul className="space-y-3">
        {sitesAvecDevis.map((s) => (
          <li key={s.id}>
            <Link
              href={`/devis/site/${s.id}`}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <MapPin className="h-5 w-5 text-amber-600" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                {s.site || "Site sans nom"}
              </span>
              <span className="shrink-0 text-sm text-slate-400">
                {nbParSite.get(s.id) ?? 0} devis · {nbCommandesParSite.get(s.id) ?? 0} commandé(s)
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

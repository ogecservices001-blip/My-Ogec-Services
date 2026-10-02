import Link from "next/link";
import { ArrowLeft, ChevronRight, MapPin, Plus, Upload, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import type { Site } from "@/lib/types";
import { supprimerSitesDuClient } from "../../actions";

export default async function SitesDuClientPage({
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
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const { data } = await supabase
    .from("sites_view")
    .select("*")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat)
    .order("site");
  const sites = (data as Site[]) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/repertoire/clients${horsContrat ? "?horsContrat=1" : ""}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href={`/repertoire/clients/groupe/${encodeURIComponent(nomDecode)}/export${horsContrat ? "?horsContrat=1" : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter les sites de ce client"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href="/repertoire/clients/importer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer un fichier"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href={`/repertoire/clients/nouveau${horsContrat ? "?horsContrat=1" : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Ajouter un site
            </Link>
          </div>
        )}
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {nomDecode}
      </h1>
      <p className="mb-5 text-sm text-slate-500">{sites.length} site(s)</p>

      <ul className="space-y-3">
        {sites.map((s) => (
          <li key={s.id}>
            <Link
              href={`/repertoire/clients/${s.id}`}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  horsContrat ? "bg-orange-100" : "bg-green-100"
                }`}
              >
                <MapPin
                  className={`h-5 w-5 ${
                    horsContrat ? "text-orange-600" : "text-brand-green-dark"
                  }`}
                  strokeWidth={2}
                />
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                {s.site || "Site sans nom"}
              </span>
              <span className="shrink-0 text-sm text-slate-400">{s.commune}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>

      {isAdmin && sites.length > 0 && (
        <div className="mt-6">
          <BoutonSupprimer
            action={supprimerSitesDuClient.bind(null, nomDecode)}
            confirmation={`Supprimer définitivement les ${sites.length} site(s) de ${nomDecode} ? Cette action est irréversible.`}
            redirectTo={`/repertoire/clients${horsContrat ? "?horsContrat=1" : ""}`}
            label="Supprimer tous les sites de ce client"
          />
        </div>
      )}
    </div>
  );
}

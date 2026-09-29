import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Upload, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Equipement, TypeEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { freqCouranteCalculeeBatch } from "@/lib/gmao/releve-service";
import { EquipementsListe } from "./equipements-liste";

export default async function EquipementsSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: site }, { data: equipements }, { data: types }, { data: references }] = await Promise.all([
    supabase.from("sites").select("id, nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("site_id", id),
    supabase.from("types_equipement").select("*"),
    supabase.from("references_horaires").select("*"),
  ]);
  if (!site) notFound();

  const isAdmin = profile?.role === "admin";
  const typesById: Record<string, TypeEquipement> = {};
  for (const t of (types ?? []) as TypeEquipement[]) typesById[t.id] = t;

  const freqCouranteParEquipement = await freqCouranteCalculeeBatch(
    supabase,
    (equipements ?? []).map((e) => e.id),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/repertoire/clients/${id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <a
                href={`/repertoire/clients/${id}/equipements/export`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Exporter en Excel"
              >
                <Download className="h-4 w-4" strokeWidth={2.25} />
              </a>
              <Link
                href={`/repertoire/clients/${id}/equipements/importer`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Importer un fichier"
              >
                <Upload className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </>
          )}
          <Link
            href={`/repertoire/clients/${id}/equipements/nouveau`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Ajouter
          </Link>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Parc GMAO</h1>
      <p className="mb-5 text-sm text-slate-500">{[site.nom, site.site].filter(Boolean).join(" — ")}</p>

      <EquipementsListe
        siteId={id}
        equipements={(equipements ?? []) as Equipement[]}
        typesById={typesById}
        references={(references ?? []) as ReferenceHoraire[]}
        freqCouranteParEquipement={freqCouranteParEquipement}
        isAdmin={isAdmin}
      />
    </div>
  );
}

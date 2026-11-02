import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Equipement, TypeEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { EquipementForm } from "../../equipement-form";

export default async function ModifierEquipementPage({
  params,
}: {
  params: Promise<{ id: string; equipementId: string }>;
}) {
  await requireAdmin();
  const { id, equipementId } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: eqData }, { data: types }, { data: references }] = await Promise.all([
    supabase.from("sites").select("id, nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("id", equipementId).eq("site_id", id).single(),
    supabase.from("types_equipement").select("*").order("nom"),
    supabase.from("references_horaires").select("*"),
  ]);
  if (!site || !eqData) notFound();
  const equipement = eqData as Equipement;

  return (
    <div>
      <Link
        href={`/gmao/clients/${id}/equipements/${equipementId}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Modifier l&apos;équipement</h1>
      <p className="mb-5 text-sm text-slate-500">{[site.nom, site.site].filter(Boolean).join(" — ")}</p>

      <EquipementForm
        siteId={id}
        types={(types ?? []) as TypeEquipement[]}
        references={(references ?? []) as ReferenceHoraire[]}
        equipementExistant={equipement}
      />
    </div>
  );
}

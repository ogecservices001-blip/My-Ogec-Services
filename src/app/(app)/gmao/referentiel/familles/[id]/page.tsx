import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { TypeEquipement, ChecklistItem, GroupeMesure } from "@/lib/gmao/types";

function chipChecklist(item: ChecklistItem) {
  switch (item.typeValeur) {
    case "enum":
      return { label: item.options.join(" / "), classe: "text-orange-600" };
    case "text":
      return { label: "Texte", classe: "text-slate-500" };
    default:
      return { label: "Effectué", classe: "text-brand-green-dark" };
  }
}

export default async function FamilleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("types_equipement").select("*").eq("id", id).single();

  if (!data) notFound();
  const famille = data as TypeEquipement;

  return (
    <div>
      <Link
        href="/gmao/referentiel/familles"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-teal-50 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white">
          <Wrench className="h-6 w-6 text-teal-600" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-teal-800">{famille.nom}</h1>
          <p className="text-sm text-slate-500">{famille.code}</p>
        </div>
      </div>

      {famille.champs_en_tete_supplementaires.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-teal-700">
            Champs d&apos;en-tête spécifiques
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {famille.champs_en_tete_supplementaires.map((c, i) => (
              <div
                key={c.cle}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-slate-50" : ""
                }`}
              >
                <span className="text-sm text-slate-700">{c.label}</span>
                {c.options.length === 0 ? (
                  <span className="text-xs font-semibold text-slate-400">Texte</span>
                ) : (
                  <span className="text-xs font-semibold text-orange-500">
                    {c.options.length} choix
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-teal-700">
        Checklist d&apos;entretien ({famille.checklist.length})
      </h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {famille.checklist.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-400">Aucune opération.</p>
        ) : (
          famille.checklist.map((item, i) => {
            const chip = chipChecklist(item);
            return (
              <div
                key={item.rep}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-slate-50" : ""
                }`}
              >
                <span className="text-sm text-slate-700">
                  {item.rep}. {item.label}
                </span>
                <span className={`shrink-0 text-xs font-semibold ${chip.classe}`}>{chip.label}</span>
              </div>
            );
          })
        )}
      </div>

      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-teal-700">
        Groupes de mesures ({famille.groupes_mesures.length})
      </h2>
      <div className="space-y-2">
        {famille.groupes_mesures.length === 0 ? (
          <p className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-sm text-slate-400 shadow-sm">
            Aucun groupe de mesures.
          </p>
        ) : (
          famille.groupes_mesures.map((groupe: GroupeMesure) => (
            <div
              key={groupe.cle}
              className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{groupe.label}</p>
                {groupe.repetable && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    répétable × {groupe.nombreMax}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groupe.champs.map((c) => (
                  <span
                    key={c.cle}
                    className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                  >
                    {c.unite ? `${c.label} (${c.unite})` : c.label}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

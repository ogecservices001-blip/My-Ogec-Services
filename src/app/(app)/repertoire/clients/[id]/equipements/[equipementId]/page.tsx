import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Equipement, TypeEquipement, ChampListeLigne } from "@/lib/gmao/types";
import { concatTypeEquipement } from "@/lib/gmao/suggestion-reference-horaire";

export default async function VisualiserEquipementPage({
  params,
}: {
  params: Promise<{ id: string; equipementId: string }>;
}) {
  const { id, equipementId } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: eqData }] = await Promise.all([
    supabase.from("sites").select("id, nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("id", equipementId).eq("site_id", id).single(),
  ]);
  if (!site || !eqData) notFound();
  const eq = eqData as Equipement;

  const { data: typeData } = await supabase
    .from("types_equipement")
    .select("*")
    .eq("id", eq.type_equipement_id)
    .single();
  if (!typeData) notFound();
  const type = typeData as TypeEquipement;

  const c = eq.champs_en_tete;
  const typeConcat = concatTypeEquipement(c);
  const freqEntretienAnnuelle = typeof c.freqEntretienAnnuelle === "string" ? c.freqEntretienAnnuelle : "";

  const champsRenseignes = type.champs_en_tete_supplementaires
    .filter((champ) => typeof c[champ.cle] === "string" && (c[champ.cle] as string).trim().length > 0)
    .map((champ) => [champ.unite ? `${champ.label} (${champ.unite})` : champ.label, c[champ.cle] as string] as const);

  return (
    <div>
      <Link
        href={`/repertoire/clients/${id}/equipements`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-teal-50 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white">
          <Cog className="h-6 w-6 text-teal-600" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-600">
            {[site.nom, site.site].filter(Boolean).join(" — ")}
          </p>
          <p className="text-sm font-bold text-teal-800">
            {type.code} — {type.nom}
          </p>
          <p className="text-sm font-semibold text-slate-900">{eq.nom}</p>
          <p className="text-xs text-slate-500">
            {[eq.groupe && `Groupe : ${eq.groupe}`, [eq.numero_equipement, eq.localisation].filter(Boolean).join(" — ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {typeConcat && <p className="mt-1 text-sm font-bold text-teal-800">{typeConcat}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {champsRenseignes.length === 0 && !freqEntretienAnnuelle ? (
          <p className="px-4 py-4 text-sm text-slate-400">Aucune information renseignée</p>
        ) : (
          <dl>
            {freqEntretienAnnuelle && (
              <div className="flex items-baseline gap-2 border-b border-slate-50 px-4 py-2.5">
                <dt className="w-60 shrink-0 text-[13px] text-slate-500">Fréquence entretien annuelle</dt>
                <dd className="text-sm font-semibold text-slate-900">{freqEntretienAnnuelle}</dd>
              </div>
            )}
            {champsRenseignes.map(([label, valeur], i) => (
              <div
                key={label}
                className={`flex items-baseline gap-2 px-4 py-2.5 ${i > 0 || freqEntretienAnnuelle ? "border-t border-slate-50" : ""}`}
              >
                <dt className="w-60 shrink-0 text-[13px] text-slate-500">{label}</dt>
                <dd className="text-sm font-semibold text-slate-900">{valeur}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {type.champs_listes.map((def) => {
        const lignes = Array.isArray(c[def.cle]) ? (c[def.cle] as ChampListeLigne[]) : [];
        if (lignes.length === 0) return null;
        return (
          <div key={def.cle} className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-bold text-slate-900">{def.label}</p>
            <div className="space-y-1">
              {lignes.map((ligne, i) => (
                <p key={i} className="text-xs text-slate-600">
                  {def.sousChamps
                    .map((sc) => {
                      const v = ligne[sc.cle];
                      if (!v) return null;
                      return `${sc.label} : ${v}${sc.unite ? ` ${sc.unite}` : ""}`;
                    })
                    .filter(Boolean)
                    .join("  —  ")}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

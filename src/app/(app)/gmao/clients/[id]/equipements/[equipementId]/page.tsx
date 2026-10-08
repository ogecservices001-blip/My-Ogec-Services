import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cog, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Equipement, TypeEquipement, ChampListeLigne } from "@/lib/gmao/types";
import { concatTypeEquipement, analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { calculerHeuresVisite, heuresCumulAnnee } from "@/lib/gmao/calcul-heures-visite";
import { freqCouranteCalculee } from "@/lib/gmao/releve-service";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";
import { LABEL_STATUT_DEVIS, TEINTE_STATUT_DEVIS } from "@/app/(app)/devis/statut";
import { chargerBonsInterventionParEquipement } from "@/lib/bi/bons-par-equipement";
import { ETATS_EQUIPEMENT } from "@/lib/bi/format";
import { StatutBadge } from "@/components/bi/statut-badge";

export default async function VisualiserEquipementPage({
  params,
}: {
  params: Promise<{ id: string; equipementId: string }>;
}) {
  const { id, equipementId } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: eqData }, { data: references }] = await Promise.all([
    supabase.from("sites").select("id, nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("id", equipementId).eq("site_id", id).single(),
    supabase.from("references_horaires").select("*"),
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
  const freqAnnuelleNum = parseInt(freqEntretienAnnuelle, 10);

  const resultatReference = analyserReference(c, references ?? []);
  const freqCourante = await freqCouranteCalculee(supabase, equipementId);
  const [devisEnCours, { data: depannagesOuverts }, bonsIntervention] = await Promise.all([
    chargerDevisEnCoursParEquipement().then((parEquipement) => parEquipement[equipementId] ?? []),
    supabase
      .from("demandes_depannage")
      .select("id, numero, message")
      .eq("equipement_id", equipementId)
      .neq("statut", "traitee")
      .order("date_creation", { ascending: false }),
    chargerBonsInterventionParEquipement(equipementId),
  ]);
  const cumul =
    resultatReference.reference && Number.isFinite(freqAnnuelleNum)
      ? heuresCumulAnnee(freqAnnuelleNum, resultatReference.reference)
      : null;
  const heuresProchaineVisite =
    resultatReference.reference && Number.isFinite(freqAnnuelleNum) && freqCourante !== null
      ? calculerHeuresVisite(freqAnnuelleNum, freqCourante, resultatReference.reference)
      : null;

  const champsRenseignes = type.champs_en_tete_supplementaires
    .filter((champ) => typeof c[champ.cle] === "string" && (c[champ.cle] as string).trim().length > 0)
    .map((champ) => [champ.unite ? `${champ.label} (${champ.unite})` : champ.label, c[champ.cle] as string] as const);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/gmao/clients/${id}/equipements`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        <Link
          href={`/gmao/clients/${id}/equipements/${equipementId}/releves`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <Clock className="h-4 w-4" strokeWidth={2.25} />
          Historique des visites
        </Link>
      </div>

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

      {(devisEnCours.length > 0 || (depannagesOuverts ?? []).length > 0 || bonsIntervention.length > 0) && (
        <div className="mb-5 space-y-1.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          {devisEnCours.map((d, i) => (
            <p key={`devis-${i}`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-red-700">
              {d.numero}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TEINTE_STATUT_DEVIS[d.statut]}`}
              >
                {LABEL_STATUT_DEVIS[d.statut]}
              </span>
              — {d.libelle}
            </p>
          ))}
          {(depannagesOuverts ?? []).map((d) => (
            <p key={`dep-${d.id}`} className="text-sm font-semibold text-blue-700">
              N°{d.numero} — {d.message}
            </p>
          ))}
          {bonsIntervention.map((b, i) => (
            <div key={`bi-${i}`} className="text-sm font-semibold text-violet-700">
              <p className="flex flex-wrap items-center gap-1.5">
                {b.numero}
                <StatutBadge statut={b.statut} />
                {b.etat_equipement
                  // "Devis à établir" disparaît dès qu'un vrai devis existe pour
                  // cet équipement (déjà listé juste au-dessus) — inutile de
                  // garder l'étiquette, le devis réel fait foi.
                  .filter((e) => e !== "devis_a_etablir" || devisEnCours.length === 0)
                  .map((e) => (
                    <span key={e} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      {ETATS_EQUIPEMENT[e] ?? e}
                    </span>
                  ))}
              </p>
              <p className="font-normal text-violet-900">{b.compte_rendu || "—"}</p>
            </div>
          ))}
        </div>
      )}

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
            {cumul && (
              <div className="flex items-baseline gap-2 border-t border-slate-50 px-4 py-2.5">
                <dt className="w-60 shrink-0 text-[13px] text-slate-500">Cumul annuel</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {cumul.heuresTech}h Tech / {cumul.heuresAssistant}h Assistant
                </dd>
              </div>
            )}
            {heuresProchaineVisite && (
              <div className="flex items-baseline gap-2 border-t border-slate-50 px-4 py-2.5">
                <dt className="w-60 shrink-0 text-[13px] text-slate-500">Dont prochaine visite</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {heuresProchaineVisite.heuresTech}h Tech / {heuresProchaineVisite.heuresAssistant}h Assistant
                </dd>
              </div>
            )}
            {resultatReference.reference && (
              <div className="flex items-baseline gap-2 border-t border-slate-50 px-4 py-2.5">
                <dt className="w-60 shrink-0 text-[13px] text-slate-500">Référence catalogue</dt>
                <dd className="text-sm font-semibold text-slate-900">{resultatReference.reference.designation}</dd>
              </div>
            )}
            {resultatReference.horsCatalogue && (
              <div className="flex items-baseline gap-2 border-t border-slate-50 px-4 py-2.5">
                <dt className="w-60 shrink-0 text-[13px] text-slate-500">Heures prévues</dt>
                <dd className="text-sm font-semibold text-orange-700">
                  Puissance &quot;{typeof c.typeEquipement3 === "string" ? c.typeEquipement3 : ""}&quot; hors
                  catalogue — à ajouter aux Heures de référence
                </dd>
              </div>
            )}
            {champsRenseignes.map(([label, valeur], i) => (
              <div
                key={label}
                className={`flex items-baseline gap-2 px-4 py-2.5 ${
                  i > 0 || freqEntretienAnnuelle || cumul || heuresProchaineVisite || resultatReference.reference
                    ? "border-t border-slate-50"
                    : ""
                }`}
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

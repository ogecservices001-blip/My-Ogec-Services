"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cog, Clock } from "lucide-react";
import type {
  Equipement,
  TypeEquipement,
  ReferenceHoraire,
  ChampsEnTeteEquipement,
  ChampListeLigne,
  ChecklistValues,
  GroupesMesuresReleve,
} from "@/lib/gmao/types";
import { concatTypeEquipement, analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { calculerHeuresVisite } from "@/lib/gmao/calcul-heures-visite";
import { ChampListeEditor } from "@/components/gmao/champ-liste-editor";
import { ChampEnTeteField, TypeEquipementSelects } from "@/components/gmao/champs-famille";
import { creerReleve } from "../actions";

const OPTIONS_VALIDATION = ["Fonctionnel", "Non Fonctionnel", "Remarque ci-dessous"];

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function aujourdhui(): string {
  const d = new Date();
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function ReleveForm({
  siteId,
  site,
  equipement,
  type,
  references,
  freqCourante,
  nomTechInitial,
  nomsTechniciens,
}: {
  siteId: string;
  site: { nom: string; site: string };
  equipement: Equipement;
  type: TypeEquipement;
  references: ReferenceHoraire[];
  freqCourante: number | null;
  nomTechInitial: string;
  nomsTechniciens: string[];
}) {
  const router = useRouter();
  const action = creerReleve.bind(null, equipement.id, siteId);
  const [state, formAction, pending] = useActionState(action, null);

  const [champsEnTete, setChampsEnTete] = useState<ChampsEnTeteEquipement>(() => ({
    ...equipement.champs_en_tete,
    nomTech: nomTechInitial || equipement.champs_en_tete.nomTech || "",
    dateIntervPrevue: aujourdhui(),
  }));
  const [checklistValues, setChecklistValues] = useState<ChecklistValues>({});
  const [groupesMesures, setGroupesMesures] = useState<GroupesMesuresReleve>(() => {
    const init: GroupesMesuresReleve = {};
    for (const groupe of type.groupes_mesures) {
      const occurrences = groupe.repetable ? groupe.nombreMax : 1;
      init[groupe.cle] = Array.from({ length: occurrences }, () =>
        Object.fromEntries(groupe.champs.map((c) => [c.cle, ""])),
      );
    }
    return init;
  });
  const [validation, setValidation] = useState<string | null>(null);
  const [remarque1, setRemarque1] = useState("");
  const [remarque2, setRemarque2] = useState("");
  const [informationsInternes, setInformationsInternes] = useState("");

  useEffect(() => {
    if (state?.ok) {
      router.push(`/gmao/clients/${siteId}/equipements`);
      router.refresh();
    }
  }, [state, router, siteId]);

  const resultatReference = analyserReference(champsEnTete, references);
  const freqBrut = champsEnTete.freqEntretienAnnuelle;
  const freqAnnuelle = typeof freqBrut === "string" ? parseInt(freqBrut, 10) : NaN;
  const heuresVisite =
    resultatReference.reference && Number.isFinite(freqAnnuelle) && freqCourante !== null
      ? calculerHeuresVisite(freqAnnuelle, freqCourante, resultatReference.reference)
      : null;

  function champAvecOptionsLive(champ: TypeEquipement["champs_en_tete_supplementaires"][number]) {
    return champ.cle === "nomTech" ? { ...champ, options: nomsTechniciens } : champ;
  }

  function majGroupeMesure(cle: string, occurrences: ChampListeLigne[]) {
    setGroupesMesures((prev) => ({ ...prev, [cle]: occurrences }));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/gmao/clients/${siteId}/equipements`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        <Link
          href={`/gmao/clients/${siteId}/equipements/${equipement.id}/releves`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <Clock className="h-4 w-4" strokeWidth={2.25} />
          Historique
        </Link>
      </div>

      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-teal-50 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white">
          <Cog className="h-6 w-6 text-teal-600" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-600">{[site.nom, site.site].filter(Boolean).join(" — ")}</p>
          <p className="text-sm font-bold text-teal-800">
            {type.code} — {type.nom}
          </p>
          <p className="text-sm font-semibold text-slate-900">{equipement.nom}</p>
        </div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="champs_en_tete_json" value={JSON.stringify(champsEnTete)} />
        <input type="hidden" name="checklist_json" value={JSON.stringify(checklistValues)} />
        <input type="hidden" name="groupes_mesures_json" value={JSON.stringify(groupesMesures)} />
        <input type="hidden" name="validation_fonctionnement" value={validation ?? ""} />
        <input type="hidden" name="remarque1" value={remarque1} />
        <input type="hidden" name="remarque2" value={remarque2} />
        <input type="hidden" name="informations_internes" value={informationsInternes} />

        {state && !state.ok && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>
        )}

        {(type.type_equipement1_fixe || type.champs_en_tete_supplementaires.length > 0) && (
          <div className="mb-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Informations complémentaires</p>

            {type.type_equipement1_fixe && (
              <>
                <TypeEquipementSelects
                  typeEquipement1Fixe={type.type_equipement1_fixe}
                  references={references}
                  champsEnTete={champsEnTete}
                  setChampsEnTete={setChampsEnTete}
                />
                {concatTypeEquipement(champsEnTete) && (
                  <p className="text-sm font-bold text-teal-800">{concatTypeEquipement(champsEnTete)}</p>
                )}
                {freqCourante !== null && Number.isFinite(freqAnnuelle) && (
                  <p className="text-sm font-bold text-blue-800">
                    Visite en cours : {freqCourante} de {freqAnnuelle} {new Date().getFullYear()}
                  </p>
                )}
                {heuresVisite && (
                  <p className="text-xs font-semibold text-teal-700">
                    Heures prévues pour cette visite : {heuresVisite.heuresTech}h Tech /{" "}
                    {heuresVisite.heuresAssistant}h Assistant
                  </p>
                )}
                {resultatReference.horsCatalogue && (
                  <p className="text-xs font-semibold text-orange-700">
                    Puissance hors catalogue — heures non calculées, à ajouter aux Heures de référence.
                  </p>
                )}
              </>
            )}

            {type.champs_en_tete_supplementaires.map((champ) => (
              <ChampEnTeteField
                key={champ.cle}
                champ={champAvecOptionsLive(champ)}
                valeur={champsEnTete[champ.cle]}
                onChange={(v) => setChampsEnTete((prev) => ({ ...prev, [champ.cle]: v }))}
              />
            ))}
          </div>
        )}

        {type.champs_listes.map((def) => (
          <ChampListeEditor
            key={def.cle}
            definition={def}
            lignes={Array.isArray(champsEnTete[def.cle]) ? (champsEnTete[def.cle] as ChampListeLigne[]) : []}
            onChange={(lignes) => setChampsEnTete((prev) => ({ ...prev, [def.cle]: lignes }))}
          />
        ))}

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
          Checklist d&apos;entretien
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {type.checklist.map((item, i) => (
            <div
              key={item.rep}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-slate-50" : ""}`}
            >
              <span className="text-sm text-slate-700">
                {item.rep}. {item.label}
              </span>
              {item.typeValeur === "bool" && (
                <input
                  type="checkbox"
                  checked={checklistValues[item.rep] === true}
                  onChange={(e) => setChecklistValues((prev) => ({ ...prev, [item.rep]: e.target.checked }))}
                  className="h-4 w-4 accent-brand-green"
                />
              )}
              {item.typeValeur === "enum" && (
                <select
                  value={typeof checklistValues[item.rep] === "string" ? (checklistValues[item.rep] as string) : ""}
                  onChange={(e) => setChecklistValues((prev) => ({ ...prev, [item.rep]: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-green"
                >
                  <option value="">—</option>
                  {item.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {item.typeValeur === "text" && (
                <input
                  value={typeof checklistValues[item.rep] === "string" ? (checklistValues[item.rep] as string) : ""}
                  onChange={(e) => setChecklistValues((prev) => ({ ...prev, [item.rep]: e.target.value }))}
                  className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-green"
                />
              )}
            </div>
          ))}
        </div>

        {type.groupes_mesures.map((groupe) => (
          <div key={groupe.cle}>
            <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">{groupe.label}</p>
            {(groupesMesures[groupe.cle] ?? []).map((occurrence, i) => (
              <div key={i} className="mb-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                {groupe.repetable && (
                  <p className="mb-2 text-xs font-bold text-teal-700">
                    {groupe.label} {i + 1}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {groupe.champs.map((champ) => (
                    <div key={champ.cle}>
                      <label className="mb-0.5 block text-[11px] text-slate-500">
                        {champ.unite ? `${champ.label} (${champ.unite})` : champ.label}
                      </label>
                      <input
                        value={occurrence[champ.cle] ?? ""}
                        onChange={(e) => {
                          const copie = (groupesMesures[groupe.cle] ?? []).map((o) => ({ ...o }));
                          copie[i][champ.cle] = e.target.value;
                          majGroupeMesure(groupe.cle, copie);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Validation</p>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-800">Fonctionnement validé</p>
          <div className="flex flex-wrap gap-2">
            {OPTIONS_VALIDATION.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setValidation(o)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  validation === o
                    ? "bg-brand-green text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Remarques</p>
        <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <Remarque label="Remarque 1" value={remarque1} onChange={setRemarque1} />
          <Remarque label="Remarque 2" value={remarque2} onChange={setRemarque2} />
          <Remarque label="Informations internes" value={informationsInternes} onChange={setInformationsInternes} />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            {pending ? "Enregistrement..." : "Enregistrer le relevé"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Remarque({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      />
    </div>
  );
}

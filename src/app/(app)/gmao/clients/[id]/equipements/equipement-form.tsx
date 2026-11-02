"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLES_CHAMPS_FIXES_EQUIPEMENT, type TypeEquipement, type ReferenceHoraire, type ChampsEnTeteEquipement, type ChampListeLigne } from "@/lib/gmao/types";
import { ChampListeEditor } from "@/components/gmao/champ-liste-editor";
import { ChampEnTeteField, TypeEquipementSelects } from "@/components/gmao/champs-famille";
import { formaterDate, dateFrVersIso } from "@/lib/format";
import { creerEquipement } from "./actions";

export function EquipementForm({
  siteId,
  types,
  references,
  numeroSuggere,
  groupesExistants,
  nomTechnicienDefaut,
  frequenceDefaut,
}: {
  siteId: string;
  types: TypeEquipement[];
  references: ReferenceHoraire[];
  numeroSuggere?: string;
  groupesExistants?: string[];
  nomTechnicienDefaut?: string;
  frequenceDefaut?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(creerEquipement, null);

  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const type = types.find((t) => t.id === typeId) ?? null;
  const [champsEnTete, setChampsEnTete] = useState<ChampsEnTeteEquipement>(() => ({
    nomTechnicien: nomTechnicienDefaut ?? "",
    freqEntretienAnnuelle: frequenceDefaut ?? "",
  }));
  const champsSupplementaires = (type?.champs_en_tete_supplementaires ?? []).filter(
    (champ) => !CLES_CHAMPS_FIXES_EQUIPEMENT.includes(champ.cle as (typeof CLES_CHAMPS_FIXES_EQUIPEMENT)[number]),
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(`/gmao/clients/${siteId}/equipements`);
      router.refresh();
    }
  }, [state, router, siteId]);

  function changerType(id: string) {
    setTypeId(id);
    setChampsEnTete((prev) => ({
      nomTechnicien: prev.nomTechnicien,
      dateMES: prev.dateMES,
      freqEntretienAnnuelle: prev.freqEntretienAnnuelle,
      dateInterventionPrevue: prev.dateInterventionPrevue,
    }));
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="type_equipement_id" value={typeId} />
      <input type="hidden" name="champs_en_tete_json" value={JSON.stringify(champsEnTete)} />

      {state && !state.ok && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Famille d&apos;équipement</label>
          <select
            value={typeId}
            onChange={(e) => changerType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.nom}
              </option>
            ))}
          </select>
        </div>

        <ChampTexte label="Nom (ex: UI VRV 04-06)" name="nom" required />
        <ChampTexte label="Numéro équipement (ex: 462-01-31)" name="numero_equipement" defaultValue={numeroSuggere} />
        <ChampTexte label="Localisation" name="localisation" />
        <ChampTexte
          label="Groupe (ex: Split Système)"
          name="groupe"
          defaultValue={groupesExistants?.length === 1 ? groupesExistants[0] : undefined}
          list="groupes-existants"
          options={groupesExistants}
        />
        <ChampTexteLong label="Informations internes (jamais visible du client)" name="informations_internes" />

        {type && type.type_equipement1_fixe && (
          <TypeEquipementSelects
            typeEquipement1Fixe={type.type_equipement1_fixe}
            references={references}
            champsEnTete={champsEnTete}
            setChampsEnTete={setChampsEnTete}
          />
        )}

        <ChampFixe
          label="Nom technicien"
          valeur={typeof champsEnTete.nomTechnicien === "string" ? champsEnTete.nomTechnicien : ""}
          onChange={(v) => setChampsEnTete((prev) => ({ ...prev, nomTechnicien: v }))}
        />
        <ChampFixe
          label="Date M.E.S."
          type="date"
          valeur={typeof champsEnTete.dateMES === "string" ? champsEnTete.dateMES : ""}
          onChange={(v) => setChampsEnTete((prev) => ({ ...prev, dateMES: v }))}
        />
        <ChampFixe
          label="Fréquence entretien annuelle"
          valeur={typeof champsEnTete.freqEntretienAnnuelle === "string" ? champsEnTete.freqEntretienAnnuelle : ""}
          onChange={(v) => setChampsEnTete((prev) => ({ ...prev, freqEntretienAnnuelle: v }))}
        />
        <ChampFixe
          label="Date interv. prévue"
          type="date"
          valeur={typeof champsEnTete.dateInterventionPrevue === "string" ? champsEnTete.dateInterventionPrevue : ""}
          onChange={(v) => setChampsEnTete((prev) => ({ ...prev, dateInterventionPrevue: v }))}
        />
      </div>

      {champsSupplementaires.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            Informations spécifiques
          </p>
          <div className="space-y-3">
            {champsSupplementaires.map((champ) => (
              <ChampEnTeteField
                key={champ.cle}
                champ={champ}
                valeur={champsEnTete[champ.cle]}
                onChange={(v) => setChampsEnTete((prev) => ({ ...prev, [champ.cle]: v }))}
              />
            ))}
          </div>
        </div>
      )}

      {type &&
        type.champs_listes.map((def) => (
          <ChampListeEditor
            key={def.cle}
            definition={def}
            lignes={Array.isArray(champsEnTete[def.cle]) ? (champsEnTete[def.cle] as ChampListeLigne[]) : []}
            onChange={(lignes) => setChampsEnTete((prev) => ({ ...prev, [def.cle]: lignes }))}
          />
        ))}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={pending || !typeId}
          className="rounded-xl bg-brand-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function ChampTexte({
  label,
  name,
  required,
  defaultValue,
  list,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  list?: string;
  options?: string[];
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        list={list}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      />
      {list && options && options.length > 0 && (
        <datalist id={list}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function ChampFixe({
  label,
  valeur,
  onChange,
  type,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  type?: "date";
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type === "date" ? "date" : undefined}
        value={type === "date" ? dateFrVersIso(valeur) : valeur}
        onChange={(e) => onChange(type === "date" ? formaterDate(e.target.value) : e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      />
    </div>
  );
}

function ChampTexteLong({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      />
    </div>
  );
}

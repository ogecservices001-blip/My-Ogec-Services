"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TypeEquipement, ReferenceHoraire, ChampsEnTeteEquipement, ChampListeLigne } from "@/lib/gmao/types";
import { ChampListeEditor } from "@/components/gmao/champ-liste-editor";
import { ChampEnTeteField, TypeEquipementSelects } from "@/components/gmao/champs-famille";
import { creerEquipement } from "./actions";

export function EquipementForm({
  siteId,
  types,
  references,
}: {
  siteId: string;
  types: TypeEquipement[];
  references: ReferenceHoraire[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(creerEquipement, null);

  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const type = types.find((t) => t.id === typeId) ?? null;
  const [champsEnTete, setChampsEnTete] = useState<ChampsEnTeteEquipement>({});

  useEffect(() => {
    if (state?.ok) {
      router.push(`/repertoire/clients/${siteId}/equipements`);
      router.refresh();
    }
  }, [state, router, siteId]);

  function changerType(id: string) {
    setTypeId(id);
    setChampsEnTete({});
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
        <ChampTexte label="Numéro équipement (ex: 462-01-31)" name="numero_equipement" />
        <ChampTexte label="Localisation" name="localisation" />
        <ChampTexte label="Groupe (ex: Split Système)" name="groupe" />

        {type && type.type_equipement1_fixe && (
          <TypeEquipementSelects
            typeEquipement1Fixe={type.type_equipement1_fixe}
            references={references}
            champsEnTete={champsEnTete}
            setChampsEnTete={setChampsEnTete}
          />
        )}
      </div>

      {type && type.champs_en_tete_supplementaires.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            Informations spécifiques
          </p>
          <div className="space-y-3">
            {type.champs_en_tete_supplementaires.map((champ) => (
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

function ChampTexte({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      />
    </div>
  );
}

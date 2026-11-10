"use client";

import { ListeRecherche } from "@/components/liste-recherche";
import { useChampManquant, useSignalerRefusServeur } from "@/components/champ-manquant";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Equipement, TypeEquipement, ReferenceHoraire, ChampsEnTeteEquipement, ChampListeLigne } from "@/lib/gmao/types";
import { ChampListeEditor } from "@/components/gmao/champ-liste-editor";
import { ChampEnTeteField, TypeEquipementSelects } from "@/components/gmao/champs-famille";
import { creerEquipement, modifierEquipement } from "./actions";

export function EquipementForm({
  siteId,
  types,
  references,
  numeroSuggere,
  groupesExistants,
  nomTechnicienDefaut,
  frequenceDefaut,
  equipementExistant,
}: {
  siteId: string;
  types: TypeEquipement[];
  references: ReferenceHoraire[];
  numeroSuggere?: string;
  groupesExistants?: string[];
  nomTechnicienDefaut?: string;
  frequenceDefaut?: string;
  equipementExistant?: Equipement;
}) {
  const router = useRouter();
  const action = equipementExistant ? modifierEquipement.bind(null, equipementExistant.id) : creerEquipement;
  const [state, formAction, pending] = useActionState(action, null);
  const { signaler, surChampInvalide, fenetre } = useChampManquant();
  useSignalerRefusServeur(state, signaler);

  const [typeId, setTypeId] = useState(equipementExistant?.type_equipement_id ?? types[0]?.id ?? "");
  const type = types.find((t) => t.id === typeId) ?? null;
  // nomTech/freqEntretienAnnuelle : mêmes clés que les champs déjà
  // définis famille par famille (voir Référentiel Familles) — on ne
  // fait que pré-remplir leur valeur par défaut, le champ lui-même
  // s'affiche normalement dans "Informations spécifiques" quand la
  // famille le définit, pas de champ séparé à construire ici.
  const [champsEnTete, setChampsEnTete] = useState<ChampsEnTeteEquipement>(() =>
    equipementExistant
      ? equipementExistant.champs_en_tete
      : { nomTech: nomTechnicienDefaut ?? "", freqEntretienAnnuelle: frequenceDefaut ?? "" },
  );
  const champsSupplementaires = type?.champs_en_tete_supplementaires ?? [];

  const destination = equipementExistant
    ? `/gmao/clients/${siteId}/equipements/${equipementExistant.id}`
    : `/gmao/clients/${siteId}/equipements`;

  useEffect(() => {
    if (state?.ok) {
      router.push(destination);
      router.refresh();
    }
  }, [state, router, destination]);

  function changerType(id: string) {
    setTypeId(id);
    setChampsEnTete((prev) => ({
      nomTech: prev.nomTech,
      dateMES: prev.dateMES,
      freqEntretienAnnuelle: prev.freqEntretienAnnuelle,
      dateIntervPrevue: prev.dateIntervPrevue,
    }));
  }

  return (
    <form action={formAction} onInvalidCapture={surChampInvalide}>
      {fenetre}
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="type_equipement_id" value={typeId} />
      <input type="hidden" name="champs_en_tete_json" value={JSON.stringify(champsEnTete)} />

      {state && !state.ok && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Famille d&apos;équipement</label>
          <ListeRecherche
            id="equipement-famille"
            valeur={typeId}
            onChange={changerType}
            placeholder="Tape pour chercher la famille"
            vide="Aucune famille trouvée"
            options={types.map((t) => ({ valeur: t.id, label: t.nom, detail: t.code }))}
          />
        </div>

        <ChampTexte label="Nom (ex: UI VRV 04-06)" name="nom" defaultValue={equipementExistant?.nom} />
        <ChampTexte
          label="Numéro équipement (ex: 462-01-31)"
          name="numero_equipement"
          defaultValue={equipementExistant?.numero_equipement ?? numeroSuggere}
        />
        <ChampTexte label="Localisation" name="localisation" defaultValue={equipementExistant?.localisation} />
        <ChampTexte
          label="Groupe (ex: Split Système)"
          name="groupe"
          defaultValue={equipementExistant?.groupe ?? (groupesExistants?.length === 1 ? groupesExistants[0] : undefined)}
          list="groupes-existants"
          options={groupesExistants}
        />
        <ChampTexteLong
          label="Informations internes (jamais visible du client)"
          name="informations_internes"
          defaultValue={equipementExistant?.informations_internes}
        />

        {type && type.type_equipement1_fixe && (
          <TypeEquipementSelects
            typeEquipement1Fixe={type.type_equipement1_fixe}
            references={references}
            champsEnTete={champsEnTete}
            setChampsEnTete={setChampsEnTete}
          />
        )}
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
          onClick={(e) => {
            if (typeId) return;
            e.preventDefault();
            signaler("Choisis la famille d'équipement", "equipement-famille");
          }}
          disabled={pending}
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

function ChampTexteLong({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      />
    </div>
  );
}

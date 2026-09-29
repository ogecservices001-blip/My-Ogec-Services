"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ChampEnTete, ChampListeLigne, ChampsEnTeteEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { OcrScanButton } from "./ocr-scan-button";

/// Un champ d'en-tête spécifique à une famille (texte ou liste de choix
/// — la valeur existante est toujours proposée même si absente de la
/// liste officielle, cf. `optionsAvec` côté Flutter).
export function ChampEnTeteField({
  champ,
  valeur,
  onChange,
}: {
  champ: ChampEnTete;
  valeur: string | ChampListeLigne[] | undefined;
  onChange: (v: string) => void;
}) {
  const v = typeof valeur === "string" ? valeur : "";

  if (champ.options.length === 0) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          {champ.label}
          {champ.unite ? ` (${champ.unite})` : ""}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            value={v}
            onChange={(e) => onChange(e.target.value)}
            inputMode={champ.numerique ? "decimal" : undefined}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
          <OcrScanButton onRecognized={onChange} />
        </div>
      </div>
    );
  }

  const options = v && !champ.options.includes(v) ? [...champ.options, v] : champ.options;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{champ.label}</label>
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/// Menus déroulants en cascade Type Equipement 2 → 3, dérivés en direct
/// des heures de référence pour la famille (Type Equipement 1 fixe) —
/// remplace l'écran dédié `choisir_type_equipement_23.dart`, cohérent
/// avec la préférence de dériver depuis les champs éditables plutôt
/// que d'ouvrir un picker séparé.
export function TypeEquipementSelects({
  typeEquipement1Fixe,
  references,
  champsEnTete,
  setChampsEnTete,
}: {
  typeEquipement1Fixe: string;
  references: ReferenceHoraire[];
  champsEnTete: ChampsEnTeteEquipement;
  setChampsEnTete: Dispatch<SetStateAction<ChampsEnTeteEquipement>>;
}) {
  const type2Choisi = typeof champsEnTete.typeEquipement2 === "string" ? champsEnTete.typeEquipement2 : "";
  const type3Choisi = typeof champsEnTete.typeEquipement3 === "string" ? champsEnTete.typeEquipement3 : "";
  const cible1 = typeEquipement1Fixe.trim().toLowerCase();

  const options2 = [
    ...new Set(
      references
        .filter((r) => r.type_equipement1.trim().toLowerCase() === cible1)
        .map((r) => r.type_equipement2)
        .filter((v) => v.trim().length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const options3 = type2Choisi
    ? [
        ...new Set(
          references
            .filter(
              (r) =>
                r.type_equipement1.trim().toLowerCase() === cible1 &&
                r.type_equipement2.trim().toLowerCase() === type2Choisi.trim().toLowerCase(),
            )
            .map((r) => r.type_equipement3)
            .filter((v) => v.trim().length > 0),
        ),
      ].sort((a, b) => a.localeCompare(b))
    : [];

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Type Equipement 2</label>
        <select
          value={type2Choisi}
          onChange={(e) =>
            setChampsEnTete((prev) => ({ ...prev, typeEquipement2: e.target.value, typeEquipement3: "" }))
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        >
          <option value="">—</option>
          {options2.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Type Equipement 3 (puissance)</label>
        <select
          value={type3Choisi}
          onChange={(e) => setChampsEnTete((prev) => ({ ...prev, typeEquipement3: e.target.value }))}
          disabled={!type2Choisi}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50"
        >
          <option value="">—</option>
          {options3.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

"use client";

import { ListeRecherche } from "@/components/liste-recherche";
import type { Dispatch, SetStateAction } from "react";
import { CLES_CHAMPS_FIXES_EQUIPEMENT, type ChampEnTete, type ChampListeLigne, type ChampsEnTeteEquipement, type ReferenceHoraire } from "@/lib/gmao/types";
import { formaterDate, dateFrVersIso } from "@/lib/format";
import { OcrScanButton } from "./ocr-scan-button";

/// Champs sans bouton OCR — rien à scanner sur une plaque signalétique
/// pour une date de contrôle, un n° de bordereau, une valeur déjà
/// couverte par un autre champ (charge réfrigérant, puissance), ou un
/// champ fixe du formulaire d'ajout (nom technicien, dates, fréquence
/// — jamais sur une plaque signalétique non plus).
const SANS_OCR = new Set([
  "chargeRefrigerant",
  "puissance",
  "dateDernierControle",
  "dateProchainControle",
  "numDernierBordereau",
  "dateDernierControleDesenfumage",
  "dateProchainControleDesenfumage",
  ...CLES_CHAMPS_FIXES_EQUIPEMENT,
]);

/// Un champ d'en-tête spécifique à une famille (texte ou liste de choix
/// — la valeur existante est toujours proposée même si absente de la
/// liste officielle, cf. `optionsAvec` côté Flutter). Un champ dont la
/// clé commence par "date" (convention déjà utilisée partout dans
/// l'app : dateMES, dateDernierControle...) s'affiche avec un
/// calendrier plutôt qu'un champ texte libre.
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
    const estDate = champ.cle.toLowerCase().startsWith("date");
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          {champ.label}
          {champ.unite ? ` (${champ.unite})` : ""}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type={estDate ? "date" : undefined}
            value={estDate ? dateFrVersIso(v) : v}
            onChange={(e) => onChange(estDate ? formaterDate(e.target.value) : e.target.value)}
            inputMode={champ.numerique ? "decimal" : undefined}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
          {!SANS_OCR.has(champ.cle) && <OcrScanButton onRecognized={onChange} />}
        </div>
      </div>
    );
  }

  const options = v && !champ.options.includes(v) ? [...champ.options, v] : champ.options;
  // Liste longue (marque, réfrigérant, technicien...) : avec recherche.
  if (options.length > 6) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">{champ.label}</label>
        <ListeRecherche
          valeur={v}
          onChange={onChange}
          placeholder="Tape pour chercher"
          options={options.map((o) => ({ valeur: o, label: o }))}
        />
      </div>
    );
  }
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

  // La valeur déjà enregistrée est toujours proposée telle quelle, même
  // si le Référentiel Heures ne la contient pas au caractère près (ex.
  // "2.5 Kw" sur l'équipement vs "2.5 kw" au référentiel) — un <select>
  // HTML exige une correspondance EXACTE pour afficher la sélection,
  // une variante proche de casse ne suffit pas, cf. `optionsAvec` déjà
  // appliqué sur les autres champs à choix (ChampEnTeteField).
  const options2 = [
    ...new Set(
      references
        .filter((r) => r.type_equipement1.trim().toLowerCase() === cible1)
        .map((r) => r.type_equipement2)
        .filter((v) => v.trim().length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  if (type2Choisi && !options2.includes(type2Choisi)) options2.push(type2Choisi);

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
      ].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
    : [];
  if (type3Choisi && !options3.includes(type3Choisi)) options3.push(type3Choisi);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Type Equipement 2</label>
        <ListeRecherche
          valeur={type2Choisi}
          onChange={(v) => setChampsEnTete((prev) => ({ ...prev, typeEquipement2: v, typeEquipement3: "" }))}
          placeholder="Tape pour chercher"
          options={options2.map((v) => ({ valeur: v, label: v }))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Type Equipement 3 (puissance)</label>
        <ListeRecherche
          valeur={type3Choisi}
          onChange={(v) => setChampsEnTete((prev) => ({ ...prev, typeEquipement3: v }))}
          disabled={!type2Choisi}
          placeholder={type2Choisi ? "Tape pour chercher" : "Choisis d'abord le type 2"}
          options={options3.map((v) => ({ valeur: v, label: v }))}
        />
      </div>
    </div>
  );
}

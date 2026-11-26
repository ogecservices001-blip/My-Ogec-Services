import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";

/// Familles GMAO qui portent un fluide frigorigène (champs Réfrigérant,
/// Charge et contrôle d'étanchéité) — seules concernées par le CERFA.
export const FAMILLES_CERFA = ["mod_uevrv", "mod_split", "mod_geg", "mod_roof", "mod_cta_dd", "mod_utadd"];

/// Familles dont la référence CERFA (groupe extérieur) est dans
/// « Référence unité extérieure » ; les autres n'ont qu'une unité, rangée
/// dans « Référence unité intérieure ».
const FAMILLES_REF_EXTERIEURE = new Set(["mod_uevrv", "mod_split", "mod_geg", "mod_roof"]);

export function cleReference(typeEquipementId: string): "referenceUExt" | "referenceUInt" {
  return FAMILLES_REF_EXTERIEURE.has(typeEquipementId) ? "referenceUExt" : "referenceUInt";
}

/// Seuil retenu par le bureau : un équipement est soumis au CERFA au-delà
/// de 2 kg de charge.
export const SEUIL_CHARGE_SOUMIS_KG = 2;

export const OPERATEUR =
  "Omnium Génie Climatique Services\n918 Chemin Du Tour Des Roches\n97460 Saint-Paul";
export const ATTESTATION_NO = "1139819";
export const QUALITE_OPERATEUR = "Frigoriste";

export const FLUIDES = ["R-410A", "R32", "R-134a", "R-407C", "R22"] as const;

/// Pouvoir de réchauffement planétaire retenu par le règlement F-gaz (4e
/// rapport du GIEC). L'ancienne appli prenait 1924 pour le R-410A.
export const PRG: Record<string, number> = {
  "R-410A": 2088,
  R32: 675,
  "R-134a": 1430,
  "R-407C": 1774,
  R22: 1810,
};

const cleFluide = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

const FLUIDE_PAR_CLE: Record<string, string> = {
  R410A: "R-410A",
  R32: "R32",
  R134A: "R-134a",
  R407C: "R-407C",
  R22: "R22",
};

/// Écriture GMAO (« R410 A ») → écriture CERFA (« R-410A »).
export function fluideCerfa(valeurGmao: string): string {
  return FLUIDE_PAR_CLE[cleFluide(valeurGmao)] ?? valeurGmao.trim();
}

const FLUIDE_GMAO: Record<string, string> = {
  "R-410A": "R410 A",
  "R-407C": "R407 C",
  "R-134a": "R134 A",
};

/// Écriture CERFA → écriture du fichier équipements (« R410 A », « R32 »…).
export function fluideGmao(valeurCerfa: string): string {
  return FLUIDE_GMAO[valeurCerfa] ?? valeurCerfa;
}

/// UN 3161 (inflammable) pour le R32, UN 1078 pour les autres.
export function estInflammable(fluide: string): boolean {
  return fluide === "R32";
}

export function nombre(valeur: string | null | undefined): number | null {
  const m = /-?\d+(?:[.,]\d+)?/.exec(String(valeur ?? ""));
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function teqCO2(fluide: string, charge: string): string {
  const kg = nombre(charge);
  const prg = PRG[fluide] ?? 0;
  if (!kg || kg <= 0 || !prg) return "0.00";
  return ((kg * prg) / 1000).toFixed(2);
}

/// HCFC (R22) : seuils en kg. HFC (R-410A, R32, R-134a, R-407C) : seuils
/// en tonnes équivalent CO2.
export function estHcfc(fluide: string): boolean {
  return fluide === "R22";
}

export type Classement = {
  categorie: "HCFC" | "HFC";
  palier: 0 | 1 | 2 | 3;
  mois: number;
  libellePalier: string;
};

/// Cases 7, 8 et 9 du CERFA et fréquence du contrôle d'étanchéité.
/// HCFC : 2-30 kg / 30-300 kg / ≥ 300 kg → 12 / 6 / 3 mois.
/// HFC : 5-50 t / 50-500 t / ≥ 500 t → 12 / 6 / 3 mois sans système
/// permanent de détection, 24 / 12 / 6 mois avec.
/// Sous le seuil (palier 0) : aucune case, contrôle annuel par défaut.
export function classement(fluide: string, charge: string, systemePermanent: boolean): Classement {
  if (estHcfc(fluide)) {
    const kg = nombre(charge) ?? 0;
    const palier = kg >= 300 ? 3 : kg >= 30 ? 2 : kg >= 2 ? 1 : 0;
    return { categorie: "HCFC", palier, mois: [12, 12, 6, 3][palier], libellePalier: ["< 2 kg", "2 kg ≤ Q < 30 kg", "30 kg ≤ Q < 300 kg", "Q ≥ 300 kg"][palier] };
  }
  const t = Number(teqCO2(fluide, charge));
  const palier = t >= 500 ? 3 : t >= 50 ? 2 : t >= 5 ? 1 : 0;
  const mois = palier === 0 ? 12 : systemePermanent ? [24, 24, 12, 6][palier] : [12, 12, 6, 3][palier];
  return { categorie: "HFC", palier, mois, libellePalier: ["< 5 t.éq.CO2", "5 t ≤ teqCO2 < 50 t", "50 t ≤ teqCO2 < 500 t", "teqCO2 ≥ 500 t"][palier] };
}

export type StatutSoumission = "soumis" | "non_soumis" | "charge_inconnue";

export function statutSoumission(champs: ChampsEnTeteEquipement): StatutSoumission {
  const kg = nombre(texteChamp(champs, "chargeRefrigerant"));
  if (kg === null) return "charge_inconnue";
  return kg > SEUIL_CHARGE_SOUMIS_KG ? "soumis" : "non_soumis";
}

export function texteChamp(champs: ChampsEnTeteEquipement, cle: string): string {
  const v = champs?.[cle];
  return typeof v === "string" ? v : "";
}

export function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateFr(d: Date): string {
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/// « 05/03/2027 » → Date ; null si la valeur n'est pas une date complète.
export function lireDateFr(valeur: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((valeur ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ajouterMois(d: Date, mois: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + mois, d.getDate());
}

/// N° du bordereau (et nom du PDF) : AA-NNN-client-site-Nom équipement,
/// ex. « 26-080-475-01-Groupe VRV 05 ». Fiche N° : AAAA-NNN.
export function numeroBordereau(annee: number, chrono: number, nAffaire: string, nomEquipement: string): string {
  const [client = "", site = ""] = nAffaire.split("-");
  return `${String(annee).slice(2)}-${String(chrono).padStart(3, "0")}-${client.padStart(3, "0")}-${site.padStart(2, "0")}-${nomEquipement}`;
}

export function ficheNo(annee: number, chrono: number): string {
  return `${annee}-${String(chrono).padStart(3, "0")}`;
}

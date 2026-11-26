import { classement, nombre } from "./regles";
import type { CerfaDonnees } from "./types";

function total(...valeurs: string[]): string {
  const t = valeurs.reduce((s, v) => s + (nombre(v) ?? 0), 0);
  return Number.isInteger(t) ? t.toFixed(0) : t.toFixed(2);
}

/// Quantité chargée totale (A+B+C).
export function quantiteChargee(d: CerfaDonnees): string {
  return total(d.qa, d.qb, d.qc);
}

/// Quantité récupérée totale (D+E).
export function quantiteRecuperee(d: CerfaDonnees): string {
  return total(d.qd, d.qe);
}

/// Cases 7, 8 et 9 du CERFA (noms des champs du PDF).
export function casesPeriodicite(fluide: string, charge: string, systemePermanent: boolean): Record<string, boolean> {
  const c = classement(fluide, charge, systemePermanent);
  const hcfc = c.categorie === "HCFC";
  const p = c.palier;
  const avec = !hcfc && systemePermanent;
  return {
    Case_HCFC_2: hcfc && p === 1,
    Case_HCFC_30: hcfc && p === 2,
    Case_HCFC_300: hcfc && p === 3,
    Case_HFC_5: !hcfc && p === 1,
    Case_HFC_50: !hcfc && p === 2,
    Case_HFC_500: !hcfc && p === 3,
    Case_Sans_12m: p === 1 && !avec,
    Case_Sans_6m: p === 2 && !avec,
    Case_Sans_3m: p === 3 && !avec,
    Case_Avec_24m: p === 1 && avec,
    Case_Avec_12m: p === 2 && avec,
    Case_Avec_6m: p === 3 && avec,
  };
}

/// Déclaration annuelle des quantités : une seule case « chargé » et une
/// seule case « récupéré » reçoit la valeur, selon la nature de
/// l'intervention (même priorité que l'ancienne appli).
export function quantitesDeclaration(d: CerfaDonnees) {
  const charge = nombre(quantiteChargee(d));
  const recup = nombre(quantiteRecuperee(d));
  const neuf = d.caseAssemblage || d.caseMiseService;
  const maintenance = d.caseModif || d.caseMaintenance || d.caseCtrlPerio;
  const utile = (v: number | null) => (v && v > 0 ? v : null);
  return {
    qteChargeesNeufs: neuf ? utile(charge) : null,
    qteChargeesMaintenance: !neuf && maintenance ? utile(charge) : null,
    qteRecupMaintenance: maintenance ? utile(recup) : null,
    qteRecupHorsUsage: !maintenance && d.caseDemantel ? utile(recup) : null,
  };
}

export function natureRenseignee(d: CerfaDonnees): boolean {
  return (
    d.caseAssemblage ||
    d.caseMiseService ||
    d.caseModif ||
    d.caseMaintenance ||
    d.caseCtrlPerio ||
    d.caseCtrlNonPerio ||
    d.caseDemantel ||
    d.caseAutre
  );
}

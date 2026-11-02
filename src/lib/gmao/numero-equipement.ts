/// Prochain numéro d'équipement libre pour un site donné, au format
/// "{n° affaire}-{compteur 2 chiffres}" (ex: "462-01-31"). Partagé
/// entre la validation BI Installation neuve et l'ajout direct dans
/// GMAO — même règle des deux côtés.
export function suggererNumeroEquipement(prefixe: string, numerosExistants: string[]): string {
  if (!prefixe) return "";
  let max = 0;
  for (const n of numerosExistants) {
    if (!n.startsWith(`${prefixe}-`)) continue;
    const suffixe = parseInt(n.slice(prefixe.length + 1), 10);
    if (Number.isFinite(suffixe) && suffixe > max) max = suffixe;
  }
  return `${prefixe}-${String(max + 1).padStart(2, "0")}`;
}

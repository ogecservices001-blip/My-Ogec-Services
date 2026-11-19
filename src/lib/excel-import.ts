import type ExcelJS from "exceljs";

/// Ramène une cellule exceljs à sa valeur affichée : le résultat d'une
/// formule (simple ou partagée), le texte d'un texte enrichi ou d'un lien.
/// Une cellule en erreur (#N/A, #REF!…) compte comme vide.
export function valeurSimpleCellule(v: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== "object") return v;
  if ("result" in v) return valeurSimpleCellule((v.result ?? null) as ExcelJS.CellValue);
  if ("sharedFormula" in v || "formula" in v) return null;
  if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
  if ("text" in v) return valeurSimpleCellule((v.text ?? null) as ExcelJS.CellValue);
  if ("error" in v) return null;
  return null;
}

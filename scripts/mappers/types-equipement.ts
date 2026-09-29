import { str, type Mapper } from "./types";

function jsonArray(data: Record<string, unknown>, key: string): unknown[] {
  const v = data[key];
  return Array.isArray(v) ? v : [];
}

/// `types_equipement` Firestore → `types_equipement` Supabase. Les
/// structures imbriquées (champsEnTeteSupplementaires, champsListes,
/// checklist, groupesMesures) sont stockées telles quelles en jsonb,
/// clés camelCase incluses — ce sont les mêmes structures que
/// `type_equipement_model.dart` sérialise déjà, pas des colonnes Postgres.
export const typesEquipementMapper: Mapper = {
  name: "types-equipement",
  table: "types_equipement",
  collection: "types_equipement",
  idIsDocId: true,
  toRow: (doc) => {
    const d = doc.data;
    return {
      code: str(d, "code"),
      nom: str(d, "nom"),
      champs_en_tete_supplementaires: jsonArray(d, "champsEnTeteSupplementaires"),
      champs_listes: jsonArray(d, "champsListes"),
      checklist: jsonArray(d, "checklist"),
      groupes_mesures: jsonArray(d, "groupesMesures"),
      type_equipement1_fixe: str(d, "typeEquipement1Fixe"),
    };
  },
};

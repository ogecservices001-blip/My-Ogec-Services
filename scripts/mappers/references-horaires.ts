import { str, type Mapper } from "./types";

function num(data: Record<string, unknown>, key: string): number {
  const v = data[key];
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/// `references_horaires` Firestore → `references_horaires` Supabase.
export const referencesHorairesMapper: Mapper = {
  name: "references-horaires",
  table: "references_horaires",
  collection: "references_horaires",
  toRow: (doc) => {
    const d = doc.data;
    return {
      legacy_id: doc.id,
      designation: str(d, "designation"),
      type_equipement1: str(d, "typeEquipement1"),
      type_equipement2: str(d, "typeEquipement2"),
      type_equipement3: str(d, "typeEquipement3"),
      hrs_tech_an: num(d, "hrsTechAn"),
      hrs_assistant_an: num(d, "hrsAssistantAn"),
      hrs_tech_sem: num(d, "hrsTechSem"),
      hrs_assistant_sem: num(d, "hrsAssistantSem"),
      hrs_tech_tri: num(d, "hrsTechTri"),
      hrs_assistant_tri: num(d, "hrsAssistantTri"),
    };
  },
};

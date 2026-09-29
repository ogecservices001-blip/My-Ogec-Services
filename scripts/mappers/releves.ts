import { str, type Mapper } from "./types";

function timestampVersIso(v: unknown): string {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
    return ((v as { toDate: () => Date }).toDate()).toISOString();
  }
  return new Date().toISOString();
}

/// `releves` Firestore → `releves` Supabase.
export const relevesMapper: Mapper = {
  name: "releves",
  table: "releves",
  collection: "releves",
  dependances: ["equipements", "sites"],
  toRow: (doc, ctx) => {
    const d = doc.data;
    const equipementIdFirestore = str(d, "equipementId");
    const equipementId = ctx.legacyId("equipements", equipementIdFirestore);
    if (!equipementId) {
      throw new Error(`équipement introuvable pour equipementId="${equipementIdFirestore}"`);
    }
    const clientIdFirestore = str(d, "clientId");
    const siteId = ctx.legacyId("sites", clientIdFirestore);
    if (!siteId) {
      throw new Error(`site introuvable pour clientId="${clientIdFirestore}"`);
    }

    return {
      legacy_id: doc.id,
      equipement_id: equipementId,
      site_id: siteId,
      date: timestampVersIso(d.date),
      nom_tech: str(d, "nomTech"),
      checklist_values: d.checklistValues && typeof d.checklistValues === "object" ? d.checklistValues : {},
      groupes_mesures: d.groupesMesures && typeof d.groupesMesures === "object" ? d.groupesMesures : {},
      validation_fonctionnement: d.validationFonctionnement ?? null,
      remarque1: str(d, "remarque1"),
      remarque2: str(d, "remarque2"),
      informations_internes: str(d, "informationsInternes"),
      photos: Array.isArray(d.photos) ? d.photos : [],
    };
  },
};

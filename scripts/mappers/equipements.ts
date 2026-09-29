import { str, type Mapper } from "./types";

/// `equipements` Firestore → `equipements` Supabase. `reference_horaire_id`
/// n'est repris que si le document Firestore en porte un ET que la
/// référence correspondante a bien été importée (via son legacy_id) —
/// sinon laissé `null`, recalculé côté app à l'usage plutôt que de
/// stocker un lien potentiellement obsolète.
export const equipementsMapper: Mapper = {
  name: "equipements",
  table: "equipements",
  collection: "equipements",
  dependances: ["sites", "references_horaires"],
  toRow: (doc, ctx) => {
    const d = doc.data;
    const clientIdFirestore = str(d, "clientId");
    const siteId = ctx.legacyId("sites", clientIdFirestore);
    if (!siteId) {
      throw new Error(`site introuvable pour clientId="${clientIdFirestore}"`);
    }

    const referenceHoraireIdFirestore = str(d, "referenceHoraireId");
    const champsEnTete =
      d.champsEnTete && typeof d.champsEnTete === "object" ? (d.champsEnTete as object) : {};

    return {
      legacy_id: doc.id,
      site_id: siteId,
      type_equipement_id: str(d, "typeEquipementId"),
      reference_horaire_id: referenceHoraireIdFirestore
        ? ctx.legacyId("references_horaires", referenceHoraireIdFirestore)
        : null,
      nom: str(d, "nom"),
      numero_equipement: str(d, "numeroEquipement"),
      localisation: str(d, "localisation"),
      groupe: str(d, "groupe"),
      champs_en_tete: champsEnTete,
      hors_contrat: Boolean(d.horsContrat),
      remarque_technicien: str(d, "remarqueTechnicien"),
    };
  },
};

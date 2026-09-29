import { str, type Mapper } from "./types";

/// `suppliers` Firestore → `fournisseurs` Supabase.
export const fournisseursMapper: Mapper = {
  name: "fournisseurs",
  table: "fournisseurs",
  collection: "suppliers",
  toRow: (doc) => {
    const d = doc.data;
    return {
      legacy_id: doc.id,
      nom: str(d, "nom"),
      denomination_courte: str(d, "denominationCourte"),
      interlocuteurs: str(d, "interlocuteurs"),
      tel: str(d, "tel"),
      portable: str(d, "portable"),
      courriel: str(d, "courriel"),
      site_web: str(d, "siteWeb"),
      commune: str(d, "commune"),
      code_postal: str(d, "codePostal"),
      adresse: str(d, "adresse"),
      complement_adresse: str(d, "complementAdresse"),
      produits_cles: str(d, "produitsCles"),
      remarques: str(d, "remarques"),
    };
  },
};

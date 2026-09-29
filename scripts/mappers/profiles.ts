import { str, type Mapper } from "./types";

const ROLES_VALIDES = new Set(["admin", "technicien", "en_attente"]);

/// `users` Firestore → `profiles` Supabase. `id` n'est jamais posé ici
/// (voir moteur d'import) : ni les fiches "en attente" ni les comptes
/// avec email ne créent de compte Supabase Auth dans ce script — un
/// uuid généré suffit pour l'instant, la correspondance avec un vrai
/// compte Auth se fait au prompt "comptes et rôle client".
export const profilesMapper: Mapper = {
  name: "profiles",
  table: "profiles",
  collection: "users",
  toRow: (doc) => {
    const d = doc.data;
    const role = str(d, "role");
    return {
      legacy_id: doc.id,
      role: ROLES_VALIDES.has(role) ? role : "technicien",
      name: str(d, "name"),
      portable: str(d, "portable"),
      email_perso: str(d, "emailPerso"),
      commune_habitation: str(d, "communeHabitation"),
      vehicule: str(d, "vehicule"),
      qualite: str(d, "qualite"),
    };
  },
};

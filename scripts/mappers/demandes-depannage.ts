import { str, type Mapper } from "./types";

function timestampVersIso(v: unknown): string | null {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/// `demandes_depannage` Firestore → `demandes_depannage` Supabase.
/// equipement_id/site_id restent `null` si introuvables (FK nullable)
/// plutôt que de rejeter la ligne — l'historique de la demande
/// (instantanés client_nom/client_site/equipement_nom) reste lisible
/// même sans lien résolu.
export const demandesDepannageMapper: Mapper = {
  name: "demandes-depannage",
  table: "demandes_depannage",
  collection: "demandes_depannage",
  dependances: ["equipements", "sites"],
  toRow: (doc, ctx) => {
    const d = doc.data;
    const equipementIdFirestore = str(d, "equipementId");
    const clientIdFirestore = str(d, "clientId");

    return {
      legacy_id: doc.id,
      equipement_id: equipementIdFirestore ? ctx.legacyId("equipements", equipementIdFirestore) : null,
      site_id: clientIdFirestore ? ctx.legacyId("sites", clientIdFirestore) : null,
      client_nom: str(d, "clientNom"),
      client_site: str(d, "clientSite"),
      equipement_nom: str(d, "equipementNom"),
      email: str(d, "email"),
      message: str(d, "message"),
      statut: d.statut === "traitee" ? "traitee" : "nouvelle",
      date_creation: timestampVersIso(d.dateCreation) ?? new Date().toISOString(),
    };
  },
};

/// Identité OGEC Services (acheteur) — en dur, reprise sur chaque bon
/// de commande. Source : annuaire INSEE (donnée le 2026-10-08).
export const OGEC = {
  raisonSociale: "OMNIUM GENIE CLIMATIQUE SERVICES (OGEC SERVICES)",
  formeJuridique: "SARL",
  siren: "524 758 976",
  siret: "524 758 976 00020",
  tvaIntracom: "FR17524758976",
  adresse: "918 Chemin du Tour des Roches",
  codePostalCommune: "97460 Saint-Paul",
};

/// Même attestation que celle citée en pied du PDF Bon d'intervention
/// (@/lib/bi/pdf) — autorisation préfectorale n°1139819-R2, délivrée par
/// Bureau Veritas Certification, manipulation des fluides frigorigènes.
export const ATTESTATION_CAPACITE = {
  numero: "1139819",
  validiteDu: "23/04/2026",
  validiteAu: "22/04/2031",
};

/// Taux de TVA pré-rempli selon la localisation du fournisseur — même
/// règle que l'ancien classeur ("TVA sur facture").
export function tauxTvaDefaut(localisation: string): number {
  return localisation === "Réunion" ? 8.5 : 0;
}

/// Incoterms courants — uniquement pertinents pour un fournisseur en
/// Métropole (ou étranger), où se pose la question du transport et de
/// l'octroi de mer.
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"];

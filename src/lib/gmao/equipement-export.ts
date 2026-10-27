import type { Equipement, TypeEquipement } from "./types";
import { extraireNumero } from "./equipement-import";

/// Colonnes du format "Sommaire", dans l'ordre — pour que le fichier
/// exporté puisse être édité puis réimporté tel quel. Port de
/// `_colonnesSommaire` (equipement_export_service.dart).
export const COLONNES_SOMMAIRE = [
  "Nom Equipements",
  "Fréquence entretien annuelle",
  "Fréquence courante",
  "Type de Relevé",
  "Groupe",
  "Client",
  "Site",
  "Numéro Client",
  "Numéro Site",
  "Numéro Équipement",
  "Type Equipement 1",
  "Type Equipement 2",
  "Type Equipement 3",
  "Marque",
  "Date M.E.S.",
  "Référence unité intérieure",
  "Référence unité extérieure",
  "Numéro Série unité intérieure",
  "Numéro Série unité extérieure",
  "Localisation",
  "Date Interv prévue",
  "Nom Tech",
  "Réfrigérant",
  "Charge Réfrigérant Kg",
  "Tension Alim.",
  "Puissance",
  "Date dernier contrôle étanchéité",
  "Date Prochain contrôle étanchéité",
  "N° dernier bordereau étanchéité",
  "Date dernier contrôle désenfumage",
  "Date Prochain contrôle désenfumage",
  "Informations internes",
];

/// Tri standard d'un export "Sommaire" : par site (ordre de n_affaire —
/// numérique, pas alphabétique, pour garder l'ordre CSAPA NORD/EST/SUD
/// = 01/02/03 plutôt que l'ordre du nom), puis par Groupe, puis par
/// Numéro Équipement (numérique). Sur un export mono-site, le tri par
/// site ne change rien (toutes les lignes partagent le même n_affaire).
export function trierPourExport(
  equipements: Equipement[],
  sitesById: Record<string, { n_affaire: string }>,
): Equipement[] {
  return [...equipements].sort((a, b) => {
    const cSite = (sitesById[a.site_id]?.n_affaire ?? "").localeCompare(
      sitesById[b.site_id]?.n_affaire ?? "",
      undefined,
      { numeric: true },
    );
    if (cSite !== 0) return cSite;
    const cGroupe = a.groupe.localeCompare(b.groupe, "fr");
    if (cGroupe !== 0) return cGroupe;
    return a.numero_equipement.localeCompare(b.numero_equipement, undefined, { numeric: true });
  });
}

function cellNumerique(valeur: unknown): number | string {
  const texte = valeur?.toString() ?? "";
  const nombre = Number(texte.replace(",", "."));
  return texte && Number.isFinite(nombre) ? nombre : "";
}

function champ(c: Record<string, unknown>, cle: string): string {
  const v = c[cle];
  return typeof v === "string" ? v : "";
}

/// Construit une ligne "Sommaire" pour un équipement — "Fréquence
/// courante" laissée vide (dépend de l'historique des relevés,
/// coûteux à recalculer en masse pour un export global ; informative
/// côté Flutter, jamais réimportée).
export function ligneSommaire(
  eq: Equipement,
  site: { nom: string; site: string; n_affaire: string },
  typesById: Record<string, TypeEquipement>,
): (string | number)[] {
  const c = eq.champs_en_tete;
  const type = typesById[eq.type_equipement_id];
  const [numClientBrut, numSiteBrut] = site.n_affaire.split("-");
  return [
    eq.nom,
    cellNumerique(c.freqEntretienAnnuelle),
    "",
    type?.code ?? eq.type_equipement_id,
    eq.groupe,
    site.nom,
    site.site,
    extraireNumero(numClientBrut ?? "") ?? "",
    extraireNumero(numSiteBrut ?? "") ?? "",
    eq.numero_equipement,
    champ(c, "typeEquipement1"),
    champ(c, "typeEquipement2"),
    champ(c, "typeEquipement3"),
    champ(c, "marque"),
    champ(c, "dateMES"),
    champ(c, "referenceUInt"),
    champ(c, "referenceUExt"),
    champ(c, "numSerieUInt"),
    champ(c, "numSerieUExt"),
    eq.localisation,
    champ(c, "dateIntervPrevue"),
    champ(c, "nomTech"),
    champ(c, "typeRefrigerant"),
    cellNumerique(c.chargeRefrigerant),
    champ(c, "tensionAlim"),
    champ(c, "puissance"),
    champ(c, "dateDernierControle"),
    champ(c, "dateProchainControle"),
    champ(c, "numDernierBordereau"),
    champ(c, "dateDernierControleDesenfumage"),
    champ(c, "dateProchainControleDesenfumage"),
    eq.informations_internes,
  ];
}

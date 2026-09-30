import { NATURE_DEVIS, labelNatureDevis } from "@/lib/devis/constants";

/// Pôles métier OGEC — chaque pôle a son propre chrono annuel de
/// numérotation. Réexporte directement les codes de Devis.nature : le
/// pôle du Bon d'intervention EST la nature du travail, même liste,
/// même sens (voir @/lib/devis/constants).
export const Poles = {
  installationNeuve: "10",
  remplacementIdentique: "15",
  entretienSousContrat: "20",
  entretienHorsContrat: "25",
  reparationEquipement: "30",
  reparationDiverse: "35",
  miseADisposition: "40",
  livraisonMateriel: "50",
  /// Pôle propre au Bon d'intervention, hors de l'échelle des natures
  /// de devis — un raccourci simple pour un appel SAV express.
  depannage: "60",
} as const;

export type Pole = (typeof Poles)[keyof typeof Poles];

export const POLE_LABELS: Record<string, string> = {
  ...NATURE_DEVIS,
  [Poles.depannage]: "Dépannage",
};

export function labelPole(code: string): string {
  return POLE_LABELS[code] ?? labelNatureDevis(code);
}

/// Ordre d'affichage des pôles dans l'assistant — du plus fréquent
/// (Dépannage) au plus rare pour le technicien, pas l'ordre numérique
/// des codes.
export const ORDRE_AFFICHAGE_POLES: string[] = [
  Poles.depannage,
  Poles.remplacementIdentique,
  Poles.installationNeuve,
  Poles.reparationEquipement,
  Poles.reparationDiverse,
  Poles.entretienSousContrat,
  Poles.entretienHorsContrat,
  Poles.miseADisposition,
  Poles.livraisonMateriel,
];

/// Devis (Affaire) obligatoire — ni l'entretien sous contrat (visite
/// périodique déjà couverte par le contrat) ni le dépannage (appel SAV,
/// pas de devis préétabli) n'en ont.
export const avecAffaire = (code: string) => code !== Poles.entretienSousContrat && code !== Poles.depannage;

/// Dates en période (début/fin) plutôt qu'une date unique.
export const avecPeriode = (code: string) => code === Poles.entretienSousContrat;

/// Équipement du parc GMAO obligatoire à la création du bon.
export const avecEquipementObligatoire = (code: string) =>
  code === Poles.remplacementIdentique || code === Poles.reparationEquipement;

/// Entretien sous contrat uniquement : choix de groupes plutôt qu'un
/// équipement unique.
export const avecGroupesEntretien = (code: string) => code === Poles.entretienSousContrat;

/// Équipement du parc GMAO proposé mais pas exigé.
export const avecEquipementOptionnel = (code: string) => code === Poles.depannage || code === Poles.reparationDiverse;

/// Réparation diverse uniquement : équipement décrit à la main, non
/// répertorié dans le parc GMAO.
export const avecEquipementLibre = (code: string) => code === Poles.reparationDiverse;

/// Installation neuve uniquement : identité/caractéristiques du
/// matériel posé saisies par le technicien (pas d'équipement existant
/// à choisir).
export const avecNouvelEquipement = (code: string) => code === Poles.installationNeuve;

/// Temps passé saisi librement puis multiplié par l'effectif, plutôt
/// que calculé sur une journée type.
export const avecTempsLibre = (code: string) =>
  code === Poles.reparationEquipement || code === Poles.reparationDiverse || code === Poles.depannage;

/// Pôles liés à un devis où le temps passé n'a pas sa place dans le
/// bon : déjà couvert par le devis.
export const sansTempsPasse = (code: string) =>
  code === Poles.installationNeuve ||
  code === Poles.remplacementIdentique ||
  code === Poles.reparationEquipement ||
  code === Poles.reparationDiverse ||
  code === Poles.miseADisposition ||
  code === Poles.livraisonMateriel;

/// Dépannage uniquement : fourniture de matériel posé/consommé sur
/// place (désignation + quantité, jamais de prix).
export const avecFournitureMateriel = (code: string) => code === Poles.depannage;

/// Statuts du workflow d'un bon d'intervention.
export const Statuts = {
  brouillon: "brouillon",
  aVerifier: "averif",
  valide: "valide",
  pdfGenere: "pdf",
  pretEnvoi: "prete",
  envoye: "envoye",
  erreurSync: "erreur",
} as const;

const STATUT_LABELS: Record<string, string> = {
  [Statuts.brouillon]: "Brouillon",
  [Statuts.aVerifier]: "À vérifier (bureau)",
  [Statuts.valide]: "Validé bureau",
  [Statuts.pdfGenere]: "PDF généré",
  [Statuts.pretEnvoi]: "PDF prêt · à envoyer",
  [Statuts.envoye]: "Envoyé au client",
  [Statuts.erreurSync]: "Erreur de synchronisation",
};

export function labelStatut(s: string): string {
  return STATUT_LABELS[s] ?? s;
}

/// Clés de `champs_en_tete` jamais proposées au technicien ni affichées
/// côté bureau sur le Bon d'intervention (Installation neuve/
/// Remplacement à l'identique) : le nom du technicien est déjà connu
/// et la fréquence/date d'intervention prévue se calculent
/// automatiquement (voir @/lib/gmao/releve-service).
export const CHAMPS_MATERIEL_EXCLUS_BI = new Set(["nomTech", "freqEntretienAnnuelle", "dateIntervPrevue"]);

export const PHOTO_TYPES: Record<string, string> = {
  avant: "Avant intervention",
  defaut: "Défaut constaté",
  pendant: "Pendant intervention",
  apres: "Après intervention",
  autre: "Autre",
};

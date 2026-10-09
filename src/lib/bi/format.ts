import { Poles } from "./constants";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

export function today(): string {
  const d = new Date();
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function now(): string {
  const d = new Date();
  return `${today()} ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

/// "BI-pôle-année-chrono sur 4 chiffres" — 2 à 3 000 bons max par an,
/// pas besoin de plus.
export function numeroBI(pole: string, annee: number, chrono: number): string {
  return `BI-${pole}-${annee}-${String(chrono).padStart(4, "0")}`;
}

function parserHeure(hhmm: string): number | null {
  const parts = hhmm.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formaterDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${deuxChiffres(m)}`;
}

/// Durée "Xh" ou "XhYY" entre deux horaires "HH:mm" — vide si l'une des
/// deux heures manque.
export function dureeEntre(heureDebut: string, heureFin: string): string {
  if (!heureDebut || !heureFin) return "";
  const debut = parserHeure(heureDebut);
  const fin = parserHeure(heureFin);
  if (debut === null || fin === null) return "";
  let minutes = fin - debut;
  if (minutes < 0) minutes += 24 * 60;
  return formaterDuree(minutes);
}

/// Accepte "Xh", "XhYY" ou un nombre d'heures simple ("3", "3.5",
/// "3,5") — le technicien tape rarement le "h" au SAV.
function parserDuree(duree: string): number | null {
  const s = duree.trim();
  if (!s) return null;
  const matchH = /^(\d+)h(\d{1,2})?$/.exec(s);
  if (matchH) {
    const h = parseInt(matchH[1], 10);
    const m = matchH[2] ? parseInt(matchH[2], 10) : 0;
    return h * 60 + m;
  }
  const nombre = parseFloat(s.replace(",", "."));
  return Number.isNaN(nombre) ? null : Math.round(nombre * 60);
}

/// Même lecture que parserDuree ("7h30", "3.5"...) mais renvoyée en
/// heures décimales — pour multiplier par un taux horaire.
export function dureeEnHeures(duree: string): number | null {
  const minutes = parserDuree(duree);
  return minutes === null ? null : minutes / 60;
}

/// Multiplie une durée par le nombre de techniciens intervenus — le
/// temps passé standard représente le temps de présence sur site, mais
/// la main d'œuvre facturée compte chaque technicien. Laisse la durée
/// telle quelle si elle est illisible ou si un seul technicien est
/// intervenu.
export function multiplierDuree(duree: string, nbTechniciens: number): string {
  if (nbTechniciens <= 1) return duree;
  const minutes = parserDuree(duree);
  if (minutes === null) return duree;
  return formaterDuree(minutes * nbTechniciens);
}

/// Ajuste une durée saisie librement (Dépannage) au prorata d'un
/// changement d'effectif — pas de calcul automatique de base à
/// multiplier ici, seulement un rééquilibrage proportionnel de ce qui
/// est déjà saisi quand un technicien est ajouté ou retiré.
export function ajusterDureeEffectif(duree: string, ancienEffectif: number, nouvelEffectif: number): string {
  if (ancienEffectif <= 0 || nouvelEffectif === ancienEffectif) return duree;
  const minutes = parserDuree(duree);
  if (minutes === null || minutes === 0) return duree;
  return formaterDuree(Math.round((minutes * nouvelEffectif) / ancienEffectif));
}

/// Cumule plusieurs "temps_passe" (un par bon d'intervention lié au
/// même devis) en une seule durée affichable — ignore les entrées
/// illisibles plutôt que d'échouer.
export function sommeDurees(durees: string[]): string {
  const minutes = durees.reduce((total, d) => total + (parserDuree(d) ?? 0), 0);
  return minutes > 0 ? formaterDuree(minutes) : "";
}

function parserDateFr(jjMmAaaa: string): Date | null {
  const parts = jjMmAaaa.split("/");
  if (parts.length !== 3) return null;
  const [j, m, a] = parts.map((p) => parseInt(p, 10));
  if ([j, m, a].some(Number.isNaN)) return null;
  return new Date(a, m - 1, j);
}

/// Journée type OGEC : 7h30 du lundi au jeudi, 5h le vendredi — vide le
/// week-end (saisie manuelle requise) et toujours vide au SAV, qui
/// enchaîne plusieurs interventions dans la même journée (géré par
/// l'appelant, pas ici).
export function tempsStandard(dateFrJJMMAAAA: string): string {
  const d = parserDateFr(dateFrJJMMAAAA);
  if (!d) return "";
  const jour = d.getDay(); // 0=dimanche
  if (jour >= 1 && jour <= 4) return "7h30";
  if (jour === 5) return "5h";
  return "";
}

export type Presta = { designation: string; quantite: string; pu?: string };

/// Résumé "désignation ×quantité" des prestations, pour l'historique
/// des corrections bureau.
export function prestaSummary(prestas: Presta[]): string {
  return prestas
    .filter((p) => p.designation.trim())
    .map((p) => `${p.designation} ×${p.quantite}`)
    .join(", ");
}

/// Prix unitaire HT saisi par le bureau — jamais par le technicien.
export function parsePu(v: string): number | null {
  const n = parseFloat(v.trim().replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function montantLigne(p: Presta): number | null {
  const pu = parsePu(p.pu ?? "");
  if (pu === null) return null;
  const n = parseFloat(p.quantite.trim().replace(",", "."));
  if (Number.isNaN(n)) return null;
  return pu * n;
}

export function eur(v: number): string {
  return `${v.toFixed(2)} €`;
}

export function totalHT(prestas: Presta[]): number {
  return prestas.reduce((total, p) => total + (montantLigne(p) ?? 0), 0);
}

/// "Nom - Groupe - Localisation" (segments vides ignorés) — même format
/// partout où l'équipement du bon est affiché, pour ne jamais le
/// composer à deux endroits différemment. Installation neuve : la
/// fiche n'existe pas encore dans le parc GMAO tant que le bureau ne
/// l'a pas validée — toujours marqué comme tel.
export function equipementLabel(b: {
  pole: string;
  equipement_nom: string;
  equipement_groupe: string;
  equipement_localisation: string;
}): string {
  const base = [b.equipement_nom, b.equipement_groupe, b.equipement_localisation]
    .filter((s) => s.trim())
    .join(" - ");
  if (!base) return base;
  return b.pole === Poles.installationNeuve ? `${base} (à confirmer)` : base;
}

/// Une intervention sur un équipement au sein d'un même bon — pôle
/// Dépannage uniquement, un technicien touchant souvent plusieurs
/// équipements dans la même visite ("Autre équipement" dans
/// l'assistant). Même forme que les champs équipement/compte-rendu/
/// prestas historiques du bon, pour pouvoir les traiter avec la même
/// logique une fois fusionnés (voir `interventionsDuBon`).
export type InterventionEquipement = {
  equipement_id: string | null;
  equipement_nom: string;
  equipement_groupe: string;
  equipement_localisation: string;
  compte_rendu: string;
  prestas: Presta[];
  etat_equipement: string[];
};

/// États possibles d'un équipement sur une intervention Dépannage —
/// remplace le texte libre "Observation technicien" pour ce pôle.
/// "Équipement opérationnel" n'apparaît jamais ici : le cocher vide le
/// tableau au lieu d'y ajouter une valeur (rien à signaler).
export const ETATS_EQUIPEMENT: Record<string, string> = {
  devis_a_etablir: "Devis à établir",
  hors_service: "Équipement hors service",
};

/// Fusionne l'intervention "historique" (champs equipement_*/
/// compte_rendu/prestas directement sur le bon — la seule qui existait
/// avant le multi-équipement, toujours la première) avec celles
/// ajoutées via "Autre équipement". Un bon d'un seul équipement (tous
/// les pôles sauf Dépannage, et la plupart des Dépannages) ne renvoie
/// toujours qu'un seul élément : rien ne change pour eux.
export function interventionsDuBon(bon: {
  equipement_id: string | null;
  equipement_nom: string;
  equipement_groupe: string;
  equipement_localisation: string;
  compte_rendu: string;
  prestas: unknown;
  etat_equipement: unknown;
  interventions_supplementaires: unknown;
}): InterventionEquipement[] {
  const primaire: InterventionEquipement = {
    equipement_id: bon.equipement_id,
    equipement_nom: bon.equipement_nom,
    equipement_groupe: bon.equipement_groupe,
    equipement_localisation: bon.equipement_localisation,
    compte_rendu: bon.compte_rendu,
    prestas: (bon.prestas as Presta[] | null) ?? [],
    etat_equipement: (bon.etat_equipement as string[] | null) ?? [],
  };
  const supplementaires = (bon.interventions_supplementaires as InterventionEquipement[] | null) ?? [];
  return [primaire, ...supplementaires];
}

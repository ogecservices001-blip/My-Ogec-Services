/// Export/import "Date inter Prog Client" — même format que la feuille
/// générée par InterProg.bas dans l'ancien classeur Excel : une ligne
/// par (date, N°Affaire), les techniciens qui travaillent ensemble sur
/// cette affaire ce jour-là fusionnés en colonnes Intervenant 1 à 4,
/// heures cumulées. Une absence (pas de site/devis) est représentée
/// comme l'ancien système : Client = "Absence", mais ici la colonne
/// Site porte le vrai motif (congés, RTT...) plutôt que le texte figé
/// "Congé" — plus utile à la relecture et réimportable fidèlement.

export const ENTETES_PLANNING = [
  "Client",
  "Site",
  "N° Affaire",
  "Date",
  "Mois",
  "Semaine",
  "Heures Prévues",
  "Intervenant 1",
  "Intervenant 2",
  "Intervenant 3",
  "Intervenant 4",
];

export type LignePlanningImport = {
  numeroLigne: number;
  client: string;
  site: string;
  numeroAffaire: string;
  date: string; // "YYYY-MM-DD"
  heuresPrevues: number;
  intervenants: string[];
};

export function cleCreneau(params: {
  typeCreneau: string;
  date: string;
  siteId: string | null;
  devisId: string | null;
  motifAbsence: string;
}): string {
  if (params.typeCreneau === "absence") {
    return `absence|${params.date}|${params.motifAbsence.trim().toLowerCase()}`;
  }
  return `intervention|${params.date}|${params.siteId ?? ""}|${params.devisId ?? ""}`;
}

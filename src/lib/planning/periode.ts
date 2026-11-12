import { ajouterJours, formaterJourLong, jourSemaineUTC } from "./dates";

/// Journée type par technicien : 7h30 du lundi au jeudi, 5h le vendredi.
export function journeeType(dateISO: string): number {
  const j = jourSemaineUTC(dateISO);
  if (j >= 1 && j <= 4) return 7.5;
  if (j === 5) return 5;
  return 0;
}

export function estJourOuvre(dateISO: string, joursFeries: string[], accepterFeries = false): boolean {
  const j = jourSemaineUTC(dateISO);
  if (j === 0 || j === 6) return false;
  return accepterFeries || !joursFeries.includes(dateISO);
}

/// Jours d'une période, week-ends exclus ; jours fériés exclus sauf pour un
/// poste hors client (une absence peut tomber un jour férié).
export function joursDeLaPeriode(
  debut: string,
  fin: string,
  joursFeries: string[],
  accepterFeries = false,
): { date: string; heures: number }[] {
  if (!debut) return [];
  const borneFin = fin && fin >= debut ? fin : debut;
  const jours: { date: string; heures: number }[] = [];
  for (let d = debut; d <= borneFin && jours.length < 62; d = ajouterJours(d, 1)) {
    if (estJourOuvre(d, joursFeries, accepterFeries)) jours.push({ date: d, heures: journeeType(d) });
  }
  return jours;
}

export function prochainJourOuvre(dateISO: string, joursFeries: string[]): string {
  let d = dateISO;
  for (let i = 0; i < 30 && !estJourOuvre(d, joursFeries); i++) d = ajouterJours(d, 1);
  return d;
}

export function ajouterMois(dateISO: string, mois: number): string {
  const [a, m, j] = dateISO.split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1));
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernierJour));
  return cible.toISOString().slice(0, 10);
}

/// Visite suivante : date = début + 12/fréquence mois, ramenée au jour ouvré
/// suivant, sur le même nombre de jours ouvrés. Numéro : n+1 la même année,
/// ou visite 1 dès que la date tombe l'année suivante (compteur par année).
export function proposerVisiteSuivante(
  visite: { numero: number; total: number; annee: number },
  debut: string,
  nbJours: number,
  joursFeries: string[],
): { visite: { numero: number; total: number; annee: number }; debut: string; fin: string } {
  const nouveauDebut = prochainJourOuvre(ajouterMois(debut, Math.max(1, Math.round(12 / Math.max(1, visite.total)))), joursFeries);
  const anneeDate = Number(nouveauDebut.slice(0, 4));
  const suivante =
    anneeDate > visite.annee || visite.numero >= visite.total
      ? { numero: 1, total: visite.total, annee: Math.max(anneeDate, visite.annee + (visite.numero >= visite.total ? 1 : 0)) }
      : { numero: visite.numero + 1, total: visite.total, annee: visite.annee };
  let fin = nouveauDebut;
  let compte = 1;
  while (compte < Math.max(1, nbJours)) {
    fin = ajouterJours(fin, 1);
    if (estJourOuvre(fin, joursFeries)) compte++;
  }
  return { visite: suivante, debut: nouveauDebut, fin };
}

export function formaterHeures(h: number): string {
  const arrondi = Math.round(h * 100) / 100;
  return `${String(arrondi).replace(".", ",")} h`;
}

export type JourDemande = { date: string; heure: string | null };

export function libelleJours(jours: JourDemande[]): string[] {
  return jours.map((j) => `${formaterJourLong(j.date)} ${j.date.slice(0, 4)}${j.heure ? `, à partir de ${j.heure.slice(0, 5)}` : ""}`);
}

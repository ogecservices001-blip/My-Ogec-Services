/// Utilitaires de date pour le planning — tout en UTC explicite (jamais
/// l'heure locale). Un calcul en heure locale suivi d'un `toISOString()`
/// (UTC) décale le résultat d'un jour dès que le fuseau du navigateur
/// n'est pas UTC — exactement le bug qui faisait revenir "Semaine
/// suivante" sur la même semaine pour un visiteur à La Réunion (UTC+4).

export function ajouterJours(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/// Lundi de la semaine ISO contenant `dateISO` (ou aujourd'hui si omis).
export function lundiDeLaSemaine(dateISO?: string): string {
  const base = dateISO ?? new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T00:00:00Z`);
  const jour = d.getUTCDay(); // 0 = dimanche
  const decalage = jour === 0 ? -6 : 1 - jour;
  d.setUTCDate(d.getUTCDate() + decalage);
  return d.toISOString().slice(0, 10);
}

export function aujourdhuiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formaterJourCourt(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function formaterJourLong(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const texte = d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function jourSemaineUTC(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

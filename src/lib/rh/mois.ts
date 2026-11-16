export function finDuMois(mois: string): string {
  const [an, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(an, m, 0)).toISOString().slice(0, 10);
}

export function moisPrecedent(mois: string): string {
  const [an, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(an, m - 2, 1)).toISOString().slice(0, 7);
}

export function dateArreteParDefaut(mois: string, jour: number): string {
  const fin = finDuMois(mois);
  const d = `${mois}-${String(jour).padStart(2, "0")}`;
  return d > fin ? fin : d;
}

export const dateFr = (d: string) => d.split("-").reverse().join("/");

/// Quota horaire journalier par technicien — même règle que
/// `tempsStandard()` (src/lib/bi/format.ts) mais en nombre décimal, pour
/// pouvoir sommer les créneaux déjà posés et comparer. Un week-end
/// retourne 0 : cette fonction ne devrait jamais être appelée pour un
/// samedi/dimanche puisque la pose d'un créneau y est déjà bloquée en
/// base (voir migration 0039).
export function quotaJournalier(date: Date): number {
  const jour = date.getDay(); // 0 = dimanche
  if (jour >= 1 && jour <= 4) return 7.5;
  if (jour === 5) return 5;
  return 0;
}

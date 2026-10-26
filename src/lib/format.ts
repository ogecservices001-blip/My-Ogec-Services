/// Reformate une date ISO ("2012-06-18T00:00:00.000Z") en JJ/MM/AAAA.
/// Les champs "date" viennent de Firestore soit en ISO, soit en texte
/// libre (voire une erreur de saisie historique) — si la valeur ne
/// ressemble pas à une date ISO, on la laisse telle quelle plutôt que
/// de risquer un affichage cassé.
export function formaterDate(valeur: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valeur);
  if (!match) return valeur;
  const [, annee, mois, jour] = match;
  return `${jour}/${mois}/${annee}`;
}

/// Inverse de formaterDate (JJ/MM/AAAA -> ISO AAAA-MM-JJ) — pour donner
/// sa valeur à un <input type="date">, qui n'accepte que ce format.
/// Vide si la valeur ne ressemble pas à une date française.
export function dateFrVersIso(valeur: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(valeur);
  if (!match) return "";
  const [, jour, mois, annee] = match;
  return `${annee}-${mois}-${jour}`;
}

/// Initiales d'un nom complet ("ROBERT Ludovic" → "RL") — même calcul
/// que l'avatar de l'annuaire collaborateurs, réutilisé pour les
/// numéros de signalement.
export function initiales(nom: string): string {
  const parts = nom.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

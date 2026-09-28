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

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

/// "0692 91 02 26" → "+262 692 91 02 26" — ne touche pas aux valeurs qui
/// ne ressemblent pas à un numéro local réunionnais à 10 chiffres (vide,
/// "Inconnu", déjà international...). Utilisé partout où un numéro est
/// affiché (fiches, exports, PDF) — jamais sur un champ de saisie, pour
/// rester facile à taper au format local habituel.
export function telInternational(numero: string): string {
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length !== 10 || !chiffres.startsWith("0")) return numero;
  const groupes = chiffres.slice(1).match(/.{2}/g) ?? [];
  return `+262 ${groupes.join(" ")}`;
}

/// Inverse de telInternational — pour que les fichiers exportés restent
/// réimportables tel quels. Laisse la valeur telle quelle si elle ne
/// ressemble pas à un numéro international réunionnais.
export function telLocal(numero: string): string {
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length !== 12 || !chiffres.startsWith("262")) return numero;
  const local = `0${chiffres.slice(3)}`;
  const groupes = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(local);
  return groupes ? `${groupes[1]} ${groupes[2]} ${groupes[3]} ${groupes[4]}` : local;
}

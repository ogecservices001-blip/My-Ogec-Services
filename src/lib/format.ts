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

/// Indicatif à appliquer selon la localisation d'un fournisseur (seul
/// cas où un numéro peut être hors Réunion, voir tvaSurFacture) — `null`
/// si la localisation n'est ni "Réunion" ni "Métropole" : on préfère ne
/// pas formater plutôt que de deviner un mauvais indicatif.
export function indicatifTel(localisation: string): string | null {
  if (localisation === "Réunion") return "262";
  if (localisation === "Métropole") return "33";
  return null;
}

/// "0693 11 82 87" → "+262 693 11 82 87" (indicatif par défaut : La
/// Réunion, où se trouvent l'entreprise, ses sites clients et ses
/// collaborateurs — passer `indicatifTel(fournisseur.localisation)`
/// pour un fournisseur, qui peut être en métropole). Ne touche pas aux
/// valeurs qui ne ressemblent pas à un numéro local à 10 chiffres
/// (vide, "Inconnu", déjà international...), ni si `indicatif` est
/// `null`. Utilisé partout où un numéro est affiché (fiches, exports,
/// PDF) — jamais sur un champ de saisie, pour rester facile à taper au
/// format local habituel.
export function telInternational(numero: string, indicatif: string | null = "262"): string {
  if (!indicatif) return numero;
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length !== 10 || !chiffres.startsWith("0")) return numero;
  // 9 chiffres après le 0 : "693" puis 3 paires à La Réunion ("+262 693
  // 11 82 87"), 1 puis 4 paires en métropole ("+33 1 47 40 90 03").
  const n = chiffres.slice(1);
  const tete = indicatif === "33" ? 1 : 3;
  return `+${indicatif} ${n.slice(0, tete)} ${n.slice(tete).match(/.{2}/g)!.join(" ")}`;
}

/// Inverse de telInternational (+262 ou +33, tous deux à 9 chiffres
/// après l'indicatif) — pour que les fichiers exportés restent
/// réimportables tel quels. Laisse la valeur telle quelle si elle ne
/// ressemble pas à un numéro international connu.
export function telLocal(numero: string): string {
  const chiffres = numero.replace(/\D/g, "");
  const match = /^(262|33)(\d{9})$/.exec(chiffres);
  if (!match) return numero;
  const local = `0${match[2]}`;
  const groupes = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(local);
  return groupes ? `${groupes[1]} ${groupes[2]} ${groupes[3]} ${groupes[4]}` : local;
}

export type InterlocuteurSite = { nom: string; fixe: string; portable: string; courriel: string };

export const COLONNES_INTERLOCUTEURS_SITE = [1, 2, 3, 4]
  .flatMap((n) => {
    const s = n === 1 ? "" : `_${n}`;
    return [`interlocuteur_site${s}`, `tel_fixe_interlocuteur_site${s}`, `portable_interlocuteur_site${s}`, `courriel_interlocuteur_site${s}`];
  })
  .join(", ");

/// Interlocuteurs 1 à 4 d'un site, dans l'ordre, sans les emplacements vides
/// (un interlocuteur compte dès qu'il a un nom ou un courriel).
export function interlocuteursSite(site: Record<string, unknown> | null | undefined): InterlocuteurSite[] {
  if (!site) return [];
  const lire = (c: string) => String(site[c] ?? "").trim();
  return [1, 2, 3, 4]
    .map((n) => {
      const s = n === 1 ? "" : `_${n}`;
      return {
        nom: lire(`interlocuteur_site${s}`),
        fixe: lire(`tel_fixe_interlocuteur_site${s}`),
        portable: lire(`portable_interlocuteur_site${s}`),
        courriel: lire(`courriel_interlocuteur_site${s}`),
      };
    })
    .filter((i) => i.nom || i.courriel);
}

/// PostgREST plafonne chaque requête à 1000 lignes par défaut — toute
/// requête susceptible de dépasser ce volume (équipements sur
/// plusieurs sites, par ex.) doit paginer avec cette fonction plutôt
/// qu'un simple .select("*"), sous peine de silencieusement tronquer
/// les résultats (pas d'erreur, juste des données manquantes).
export async function recupererToutesLesLignes<T>(
  requete: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const TAILLE_PAGE = 1000;
  const resultats: T[] = [];
  let debut = 0;
  for (;;) {
    const { data, error } = await requete(debut, debut + TAILLE_PAGE - 1);
    if (error) throw new Error(error.message);
    resultats.push(...(data ?? []));
    if (!data || data.length < TAILLE_PAGE) break;
    debut += TAILLE_PAGE;
  }
  return resultats;
}

/// Numéro de ticket au format "AAAA-NNN" (compteur remis à zéro chaque
/// année) — même mécanisme prévu pour les chronos Bon d'intervention
/// (voir migration 0012, fonction `prochain_chrono`, security definer).
/// Le client passé peut être le client de session normal (formulaire
/// bureau) ou le client admin (page publique, visiteur anonyme) : les
/// deux exposent `.rpc()`, seul le type précis diffère.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function prochainChrono(supabase: any, cle: string, annee = new Date().getFullYear()): Promise<string> {
  const { data, error } = await supabase.rpc("prochain_chrono", { p_cle: cle, p_annee: annee });
  if (error || data === null || data === undefined) {
    throw new Error(error?.message ?? "Échec du calcul du numéro de ticket.");
  }
  return `${annee}-${data}`;
}

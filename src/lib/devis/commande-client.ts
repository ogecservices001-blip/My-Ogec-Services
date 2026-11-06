export const BUCKET_COMMANDES = "devis-commandes";

export type FichierCommandeClient = { chemin: string; nom: string; type: string; ajoute_le: string };

export const TYPES_COMMANDE_ACCEPTES = ["application/pdf", "image/jpeg", "image/png"];

export function fichiersCommandeClient(valeur: unknown): FichierCommandeClient[] {
  return Array.isArray(valeur) ? (valeur as FichierCommandeClient[]) : [];
}

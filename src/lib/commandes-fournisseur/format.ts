export type LigneCommande = { code: string; designation: string; quantite: string; prix_unitaire: string; remise: string };

export function ligneVide(): LigneCommande {
  return { code: "", designation: "", quantite: "1", prix_unitaire: "", remise: "" };
}

function nombre(v: string): number | null {
  const n = parseFloat(v.trim().replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/// Montant HT de la ligne, remise (%) du fournisseur déduite — un
/// devis fournisseur applique très souvent une remise par ligne (ex :
/// 60%), sans quoi le montant calculé est largement surévalué.
export function montantLigne(l: LigneCommande): number | null {
  const pu = nombre(l.prix_unitaire);
  const qte = nombre(l.quantite);
  if (pu === null || qte === null) return null;
  // Lignes déjà enregistrées avant l'ajout du champ remise : pas de clé
  // "remise" dans le jsonb stocké, donc l.remise peut être undefined à
  // l'exécution malgré le typage.
  const remise = nombre(l.remise ?? "") ?? 0;
  return pu * qte * (1 - remise / 100);
}

export function totalHT(lignes: LigneCommande[]): number {
  return lignes.reduce((total, l) => total + (montantLigne(l) ?? 0), 0);
}

export function calculerTotaux(lignes: LigneCommande[], tauxTva: number): { ht: number; tva: number; ttc: number } {
  const ht = totalHT(lignes);
  const tva = ht * (tauxTva / 100);
  return { ht, tva, ttc: ht + tva };
}

/// Formatage manuel (espace simple comme séparateur de milliers) plutôt
/// que toLocaleString("fr-FR") : son espace fine insécable (U+202F)
/// n'existe pas dans l'encodage Helvetica/WinAnsi du générateur de PDF
/// (@react-pdf/renderer) et s'y affiche comme un caractère aléatoire
/// (ex : "3/552,00" au lieu de "3 552,00").
export function eur(v: number): string {
  const negatif = v < 0;
  const [entier, decimales] = Math.abs(v).toFixed(2).split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negatif ? "-" : ""}${groupes},${decimales} €`;
}

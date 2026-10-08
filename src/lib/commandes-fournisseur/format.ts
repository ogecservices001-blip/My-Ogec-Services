export type LigneCommande = { code: string; designation: string; quantite: string; prix_unitaire: string };

export function ligneVide(): LigneCommande {
  return { code: "", designation: "", quantite: "1", prix_unitaire: "" };
}

function nombre(v: string): number | null {
  const n = parseFloat(v.trim().replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function montantLigne(l: LigneCommande): number | null {
  const pu = nombre(l.prix_unitaire);
  const qte = nombre(l.quantite);
  if (pu === null || qte === null) return null;
  return pu * qte;
}

export function totalHT(lignes: LigneCommande[]): number {
  return lignes.reduce((total, l) => total + (montantLigne(l) ?? 0), 0);
}

export function calculerTotaux(lignes: LigneCommande[], tauxTva: number): { ht: number; tva: number; ttc: number } {
  const ht = totalHT(lignes);
  const tva = ht * (tauxTva / 100);
  return { ht, tva, ttc: ht + tva };
}

export function eur(v: number): string {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

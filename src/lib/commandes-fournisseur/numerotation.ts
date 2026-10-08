/// Le n° de devis ("D-26-279-BG-362-32-10") contient déjà année, n°
/// client et n° site et nature — on les réutilise tels quels pour
/// numéroter la commande fournisseur, comme le faisait la macro VBA
/// (MID sur le n° d'affaire).
export function piecesDepuisNumeroDevis(numeroDevis: string): { annee: string; client: string; site: string; nature: string } | null {
  const p = numeroDevis.split("-");
  if (p.length < 7 || p[0] !== "D") return null;
  return { annee: p[1], client: p[4], site: p[5], nature: p[6] };
}

/// "C-{initiales rédacteur}-{année}-OS {n° client}-{n° site}-{nature}-
/// {initiales fournisseur}-{chrono propre à ce fournisseur}", même
/// esprit que l'ancien classeur ("C-BG-25-OS 270-01-10-CLIM+-001").
export function formaterNumeroCommande(p: {
  initiales: string;
  annee: string;
  client: string;
  site: string;
  nature: string;
  initialesFournisseur: string;
  chrono: number;
}): string {
  return `C-${p.initiales}-${p.annee}-OS ${p.client}-${p.site}-${p.nature}-${p.initialesFournisseur}-${String(p.chrono).padStart(3, "0")}`;
}

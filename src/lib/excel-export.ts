import type { Worksheet } from "exceljs";

/// Insère la date du jour (jj_mm_aaaa) juste avant l'extension d'un nom
/// de fichier exporté (ex: "sites.xlsx" → "sites_16_10_2026.xlsx") — à
/// appliquer sur le nom final de chaque export .xlsx de l'application.
export function nomFichierAvecDate(nomFichier: string): string {
  const d = new Date();
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const date = `${jj}_${mm}_${d.getFullYear()}`;
  return nomFichier.replace(/(\.[a-zA-Z0-9]+)$/, `_${date}$1`);
}

/// Ajuste la largeur de chaque colonne au contenu le plus long qu'elle
/// contient et active le filtre Excel sur la ligne d'en-têtes — à
/// appeler juste avant l'écriture du classeur, sur chaque feuille de
/// chaque export de l'application.
export function finaliserFeuille(feuille: Worksheet): void {
  const nbColonnes = feuille.columnCount;
  for (let i = 1; i <= nbColonnes; i++) {
    const colonne = feuille.getColumn(i);
    let largeurMax = 8;
    colonne.eachCell({ includeEmpty: false }, (cellule) => {
      // .text (pas .value) pour mesurer le texte affiché — une date ou
      // un nombre formaté ne doit pas être mesuré sur sa valeur brute.
      largeurMax = Math.max(largeurMax, cellule.text.length);
    });
    colonne.width = Math.min(largeurMax + 2, 60);
  }

  const nbLignes = feuille.rowCount;
  if (nbColonnes > 0 && nbLignes > 0) {
    feuille.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: nbLignes, column: nbColonnes },
    };
  }
}

import type { Worksheet } from "exceljs";

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

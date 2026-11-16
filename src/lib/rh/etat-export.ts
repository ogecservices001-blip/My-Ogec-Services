import ExcelJS from "exceljs";
import { dateFr, finDuMois, type EtatPreparatoire, type LigneEtatComplete } from "./etat";

export const DOSSIER = "SARL OGEC SERVICES";

export function nomMois(mois: string): string {
  const [an, m] = mois.split("-").map(Number);
  const nom = new Date(Date.UTC(an, m - 1, 1)).toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

export const titre = (mois: string) => `ETAT PREPARATOIRE A LA SAISIE DES BULLETINS DE ${mois.slice(5, 7)}/${mois.slice(0, 4)}`;
export const absencesDebut = (l: LigneEtatComplete) => l.absences.map((a) => dateFr(a.debut)).join("\n");
export const absencesFin = (l: LigneEtatComplete) => l.absences.map((a) => dateFr(a.fin)).join("\n");
export const absencesMotif = (l: LigneEtatComplete) => l.absences.map((a) => a.motif).join("\n");

export async function classeurEtat(etat: EtatPreparatoire): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Recap ${nomMois(etat.mois)}`, {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [28, 11.5, 11.5, 11.5, 11.5, 11.5, 18.5, 10, 11.5, 11.5, 11.5, 46].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getCell("B2").value = "Dossier : ";
  ws.getCell("C2").value = DOSSIER;
  ws.mergeCells("C2:E2");
  ws.getCell("C2").font = { bold: true };
  ws.getCell("G2").value = "Le : ";
  const [an, m, j] = finDuMois(etat.mois).split("-").map(Number);
  ws.getCell("H2").value = new Date(Date.UTC(an, m - 1, j));
  ws.getCell("H2").numFmt = "dd/mm/yyyy";
  ws.getCell("B5").value = "Page :";
  ws.getCell("C5").value = 1;
  ws.mergeCells("A7:L7");
  ws.getCell("A7").value = titre(etat.mois);
  ws.getCell("A7").font = { bold: true, size: 13 };
  ws.getCell("A7").alignment = { horizontal: "center" };
  ws.mergeCells("A8:L8");

  const entetes: [string, string][] = [
    ["A9:A10", "Nom et Prénom"],
    ["B9:B10", "Heures travaillées"],
    ["C9:C10", "Heures supp. 25%"],
    ["D9:D10", "Heures supp. 50%"],
    ["E9:F9", "Absences"],
    ["G9:G10", "Motif CP, AT maladie …"],
    ["H9:I9", "Paniers"],
    ["J9:J10", "Indemnités Trajet"],
    ["K9:K10", "Indemnités Transport"],
    ["L9:L10", "Observations"],
  ];
  for (const [plage, texte] of entetes) {
    ws.mergeCells(plage);
    ws.getCell(plage.split(":")[0]).value = texte;
  }
  ws.getCell("E10").value = "1er jour (inclus)";
  ws.getCell("F10").value = "Dernier jour (inclus)";
  ws.getCell("H10").value = "Nb";
  ws.getCell("I10").value = "Montant";
  const bordure: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  for (const r of [9, 10]) {
    for (let c = 1; c <= 12; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = bordure;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    }
  }
  ws.getRow(9).height = 22;
  ws.getRow(10).height = 28;

  const ecrire = (l: LigneEtatComplete) => {
    const technique = l.bloc === "technique";
    const row = ws.addRow([
      l.nom,
      l.heures,
      technique ? l.hs25 : null,
      technique ? l.hs50 : null,
      absencesDebut(l) || null,
      absencesFin(l) || null,
      absencesMotif(l) || null,
      technique ? l.paniersNb : null,
      technique ? l.paniersMontant : null,
      technique ? l.trajet : null,
      technique ? l.transport : null,
      l.observations || null,
    ]);
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      if (c > 12) return;
      cell.border = bordure;
      cell.alignment = { vertical: "top", wrapText: true, horizontal: c === 1 || c === 7 || c === 12 ? "left" : "center" };
      if (c === 9 || c === 10 || c === 11) cell.numFmt = '#,##0.00 "€"';
    });
    const lignesTexte = Math.max(1, l.absences.length, (l.observations || "").split("\n").length);
    row.height = Math.max(18, lignesTexte * 13);
  };

  for (const l of etat.lignes.filter((x) => x.bloc === "technique")) ecrire(l);
  ws.addRow([]);
  const separateur = ws.addRow([]);
  ws.mergeCells(`A${separateur.number}:L${separateur.number}`);
  for (const l of etat.lignes.filter((x) => x.bloc === "autre")) ecrire(l);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

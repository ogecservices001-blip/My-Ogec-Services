"use server";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { finaliserFeuille } from "@/lib/excel-export";
import { chargerLignesAnnee } from "@/lib/rh/lignes";
import { chargerContexteRecap, recapParSalarie, totalRecap, type LigneRecap } from "@/lib/rh/annuel";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export async function exporterRecapAnnuel(annee: number, mois: number): Promise<string> {
  await requireAdmin();
  if (!Number.isInteger(annee) || !Number.isInteger(mois) || mois < 1 || mois > 12) throw new Error("Période invalide.");
  const supabase = await createClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [lignes, contexte] = await Promise.all([chargerLignesAnnee(supabase, annee, aujourdhui), chargerContexteRecap(supabase)]);
  const annuel = recapParSalarie(lignes, contexte);
  const mensuel = recapParSalarie(
    lignes.filter((l) => Number(l.date.slice(5, 7)) === mois),
    contexte,
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Récapitulatifs Personnels");
  const motifs = annuel.motifs;
  const entetes = ["Salarié", "Heures Total", "H Norm", "H.S. 25%", "H.S. 50%", "H.S. 100%", ...motifs, "Nb Paniers", "Montant Paniers", "Trajets", "Transports"];
  const bloc = (titre: string, donnees: LigneRecap[]) => {
    const t = ws.addRow([titre]);
    t.font = { bold: true, size: 13 };
    const e = ws.addRow(entetes);
    e.font = { bold: true };
    e.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    e.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } }));
    for (const l of [...donnees, totalRecap(donnees, motifs)]) {
      const r = ws.addRow([
        l.nom,
        l.total || null,
        l.hn || null,
        l.hs25 || null,
        l.hs50 || null,
        l.hs100 || null,
        ...motifs.map((m) => l.absences[m] || null),
        l.paniersNb || null,
        l.paniersMontant || null,
        l.trajet || null,
        l.transport || null,
      ]);
      if (l.cle === "total") r.font = { bold: true };
      for (let c = entetes.length - 2; c <= entetes.length; c++) r.getCell(c).numFmt = '#,##0.00 "€"';
    }
    ws.addRow([]);
    ws.addRow([]);
  };
  bloc(`Récapitulatif annuel ${annee}${annee === Number(aujourdhui.slice(0, 4)) ? ` (au ${aujourdhui.split("-").reverse().join("/")})` : ""}`, annuel.lignes);
  bloc(`Récapitulatif mensuel ${MOIS[mois - 1]} ${annee}`, mensuel.lignes);
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= entetes.length; c++) ws.getColumn(c).width = 13;

  const detail = wb.addWorksheet("Détail de l'année");
  detail.addRow([
    "Date",
    "Salariés",
    "Noms Clients",
    "Noms site",
    "N°Affaire",
    "Poles",
    "Heures Normales",
    "H.S. 25%",
    "H.S. 50%",
    "H.S. 100%",
    "Absence",
    "Nb Panier",
    "Panier Montant",
    "Départ Domicile",
    "Arrivée Chantier",
    "Prime Trajet",
    "Véhicule personnel",
    "Valeur Prime Transport",
  ]);
  detail.getRow(1).font = { bold: true };
  const tri = [...lignes].sort((a, b) => a.date.localeCompare(b.date) || a.salarie.localeCompare(b.salarie, "fr"));
  for (const l of tri) {
    const [a, m, j] = l.date.split("-").map(Number);
    const r = detail.addRow([
      new Date(Date.UTC(a, m - 1, j)),
      l.salarie,
      l.client,
      l.site,
      l.nAffaire,
      l.pole,
      l.hn || null,
      l.hs25 || null,
      l.hs50 || null,
      l.hs100 || null,
      l.source === "absence" ? l.motifAbsence : null,
      l.panierNb || null,
      l.panierMontant || null,
      l.commune ? "Saint-Paul" : null,
      l.commune || null,
      l.trajet || null,
      l.vehiculePerso ? "Oui" : null,
      l.transport || null,
    ]);
    r.getCell(1).numFmt = "dd/mm/yyyy";
  }
  finaliserFeuille(detail);
  return Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
}

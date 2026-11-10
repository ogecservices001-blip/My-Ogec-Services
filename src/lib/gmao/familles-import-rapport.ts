import ExcelJS from "exceljs";
import { finaliserFeuille } from "@/lib/excel-export";
import type { FamilleImportee } from "./familles-import";
import type { ChampEnTete, ChecklistItem, TypeEquipement } from "./types";

/// Rapport .xlsx de l'import du Référentiel équipements : une ligne par
/// action réellement faite (famille créée, élément ajouté, valeur modifiée,
/// ordre changé), jamais les lignes inchangées.
/// - ajout → ligne entière en rouge ;
/// - modification → cellule en rouge, "nouvelle (était : ancienne)".

const COLONNES = [
  "Résultat",
  "Code famille",
  "Famille",
  "Partie",
  "Liste / Groupe",
  "N° / Ordre",
  "Libellé",
  "Unité",
  "Type",
  "Choix",
  "Même ligne que le suivant",
  "Répétable",
  "Nombre max",
  "Détail",
] as const;
type Colonne = (typeof COLONNES)[number];
type Valeurs = Partial<Record<Colonne, string>>;
type LigneRapport = { valeurs: Valeurs; rouges: Set<Colonne>; toutRouge: boolean };

const ouiNon = (v: boolean | undefined) => (v ? "Oui" : "Non");
const TYPE_REPONSE: Record<string, string> = { bool: "Fait", enum: "Choix", text: "Texte" };
const typeChamp = (c: ChampEnTete) => (c.options?.length ? "Liste de choix" : c.numerique ? "Numérique" : "Texte");
const valChamp = (c: ChampEnTete): Valeurs => ({
  "Libellé": c.label,
  "Unité": c.unite ?? "",
  "Type": typeChamp(c),
  "Choix": (c.options ?? []).join(" ; "),
  "Même ligne que le suivant": ouiNon(c.memeLigneSuivant),
});
const valOperation = (c: ChecklistItem): Valeurs => ({
  "N° / Ordre": String(c.rep),
  "Libellé": c.label,
  "Type": TYPE_REPONSE[c.typeValeur ?? "bool"] ?? String(c.typeValeur),
  "Choix": c.typeValeur === "enum" ? (c.options ?? []).join(" ; ") : "",
});

export function lignesRapportFamilles(existantes: TypeEquipement[], familles: FamilleImportee[]): LigneRapport[] {
  const lignes: LigneRapport[] = [];

  for (const f of familles) {
    const avant = existantes.find((e) => e.id === f.id);
    const base: Valeurs = { "Code famille": f.code, "Famille": f.nom };

    const ajout = (resultat: string, partie: string, v: Valeurs) =>
      lignes.push({ valeurs: { "Résultat": resultat, ...base, "Partie": partie, ...v }, rouges: new Set(), toutRouge: true });

    const modif = (partie: string, apres: Valeurs, anciennes: Valeurs, fixes: Valeurs = {}, detail?: string) => {
      const valeurs: Valeurs = { "Résultat": "Modifié", ...base, "Partie": partie, ...fixes };
      const rouges = new Set<Colonne>();
      for (const k of Object.keys(apres) as Colonne[]) {
        const n = apres[k] ?? "";
        const a = anciennes[k] ?? "";
        if (n !== a) {
          valeurs[k] = `${n || "vide"} (était : ${a || "vide"})`;
          rouges.add(k);
        } else valeurs[k] = n;
      }
      if (detail) {
        valeurs["Détail"] = detail;
        rouges.add("Détail");
      }
      if (rouges.size > 0) lignes.push({ valeurs, rouges, toutRouge: false });
    };

    const ordre = (partie: string, avantListe: string[], apresListe: string[]) => {
      const communsAvant = avantListe.filter((x) => apresListe.includes(x));
      const communsApres = apresListe.filter((x) => avantListe.includes(x));
      if (communsAvant.join("|") === communsApres.join("|")) return;
      lignes.push({
        valeurs: { "Résultat": "Ordre modifié", ...base, "Partie": partie, "Détail": `Avant : ${avantListe.join(", ")} → Après : ${apresListe.join(", ")}` },
        rouges: new Set<Colonne>(["Détail"]),
        toutRouge: false,
      });
    };

    if (!avant) {
      ajout("Nouvelle famille", "Famille", { "Type": f.type_equipement1_fixe });
      const R = "Ajouté (nouvelle famille)";
      f.champs_en_tete_supplementaires.forEach((c, i) => ajout(R, "Champ", { "N° / Ordre": String(i + 1), ...valChamp(c) }));
      for (const l of f.champs_listes) for (const s of l.sousChamps) ajout(R, "Liste", { "Liste / Groupe": l.label, "Libellé": s.label, "Unité": s.unite ?? "" });
      for (const c of f.checklist) ajout(R, "Checklist", valOperation(c));
      for (const g of f.groupes_mesures)
        for (const m of g.champs)
          ajout(R, "Mesure", { "Liste / Groupe": g.label, "Libellé": m.label, "Unité": m.unite ?? "", "Répétable": ouiNon(g.repetable), "Nombre max": String(g.nombreMax) });
      continue;
    }

    modif(
      "Famille",
      { "Code famille": f.code, "Famille": f.nom, "Type": f.type_equipement1_fixe },
      { "Code famille": avant.code, "Famille": avant.nom, "Type": avant.type_equipement1_fixe },
    );

    f.champs_en_tete_supplementaires.forEach((c, i) => {
      const a = avant.champs_en_tete_supplementaires.find((x) => x.cle === c.cle);
      if (!a) return ajout("Ajouté", "Champ", { "N° / Ordre": String(i + 1), ...valChamp(c) });
      const retires = (a.options ?? []).filter((o) => !(c.options ?? []).includes(o));
      modif("Champ", valChamp(c), valChamp(a), { "N° / Ordre": String(i + 1) }, retires.length ? `Choix retirés : ${retires.join(", ")}` : undefined);
    });
    ordre(
      "Champs",
      avant.champs_en_tete_supplementaires.map((c) => c.label),
      f.champs_en_tete_supplementaires.map((c) => c.label),
    );

    for (const l of f.champs_listes) {
      const la = avant.champs_listes.find((x) => x.cle === l.cle);
      if (!la) {
        for (const s of l.sousChamps) ajout("Ajouté", "Liste", { "Liste / Groupe": l.label, "Libellé": s.label, "Unité": s.unite ?? "" });
        continue;
      }
      modif("Liste", { "Liste / Groupe": l.label }, { "Liste / Groupe": la.label });
      for (const s of l.sousChamps) {
        const sa = la.sousChamps.find((x) => x.cle === s.cle);
        if (!sa) ajout("Ajouté", "Liste", { "Liste / Groupe": l.label, "Libellé": s.label, "Unité": s.unite ?? "" });
        else modif("Liste", { "Libellé": s.label, "Unité": s.unite ?? "" }, { "Libellé": sa.label, "Unité": sa.unite ?? "" }, { "Liste / Groupe": l.label });
      }
    }

    for (const c of f.checklist) {
      const a = avant.checklist.find((x) => x.rep === c.rep);
      if (!a) ajout("Ajouté", "Checklist", valOperation(c));
      else {
        const retires = a.typeValeur === "enum" ? (a.options ?? []).filter((o) => !(c.options ?? []).includes(o)) : [];
        modif("Checklist", valOperation(c), valOperation(a), {}, retires.length ? `Choix retirés : ${retires.join(", ")}` : undefined);
      }
    }
    ordre(
      "Checklist",
      avant.checklist.map((c) => String(c.rep)),
      f.checklist.map((c) => String(c.rep)),
    );

    for (const g of f.groupes_mesures) {
      const ga = avant.groupes_mesures.find((x) => x.cle === g.cle);
      const valGroupe = (x: typeof g): Valeurs => ({ "Liste / Groupe": x.label, "Répétable": ouiNon(x.repetable), "Nombre max": String(x.nombreMax) });
      if (!ga) {
        for (const m of g.champs) ajout("Ajouté", "Mesure", { ...valGroupe(g), "Libellé": m.label, "Unité": m.unite ?? "" });
        continue;
      }
      modif("Groupe de mesures", valGroupe(g), valGroupe(ga));
      for (const m of g.champs) {
        const ma = ga.champs.find((x) => x.cle === m.cle);
        if (!ma) ajout("Ajouté", "Mesure", { "Liste / Groupe": g.label, "Libellé": m.label, "Unité": m.unite ?? "" });
        else modif("Mesure", { "Libellé": m.label, "Unité": m.unite ?? "" }, { "Libellé": ma.label, "Unité": ma.unite ?? "" }, { "Liste / Groupe": g.label });
      }
    }
  }

  return lignes;
}

export async function classeurRapportFamilles(
  existantes: TypeEquipement[],
  familles: FamilleImportee[],
  avertissements: string[],
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Rapport d'import");
  feuille.addRow([...COLONNES]);
  feuille.getRow(1).font = { bold: true };
  const ROUGE = { color: { argb: "FFCC0000" }, bold: true };

  const lignes = lignesRapportFamilles(existantes, familles);
  if (lignes.length === 0) feuille.addRow(["Aucun changement : le référentiel est déjà à jour."]);
  for (const l of lignes) {
    const row = feuille.addRow(COLONNES.map((c) => l.valeurs[c] ?? ""));
    COLONNES.forEach((c, i) => {
      if (l.toutRouge || l.rouges.has(c)) row.getCell(i + 1).font = ROUGE;
    });
  }
  finaliserFeuille(feuille);

  if (avertissements.length > 0) {
    const fa = workbook.addWorksheet("Avertissements");
    fa.addRow(["Message"]);
    fa.getRow(1).font = { bold: true };
    for (const a of avertissements) fa.addRow([a]);
    finaliserFeuille(fa);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

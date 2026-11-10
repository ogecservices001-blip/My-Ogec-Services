import ExcelJS from "exceljs";
import type { ChampEnTete, ChampListe, ChecklistItem, GroupeMesure, TypeEquipement } from "./types";

/// Import du Référentiel équipements (familles) depuis le classeur produit
/// par l'export (5 onglets). Une famille est reconnue par son repère, sinon
/// par son code ; un élément par son repère, sinon par son libellé (n° pour
/// la checklist). Rien n'est jamais supprimé : un élément absent du fichier
/// est conservé (il peut avoir servi dans des relevés) et signalé.

export type FamilleImportee = Pick<
  TypeEquipement,
  "id" | "code" | "nom" | "type_equipement1_fixe" | "champs_en_tete_supplementaires" | "champs_listes" | "checklist" | "groupes_mesures"
>;

export type ResumeFamille = {
  code: string;
  nom: string;
  nouvelle: boolean;
  changements: string[];
};

export type ResultatImportFamilles = {
  familles: FamilleImportee[];
  resumes: ResumeFamille[];
  avertissements: string[];
};

const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

function texte(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("result" in v) return String(v.result ?? "").trim();
    if ("text" in v) return String(v.text ?? "").trim();
  }
  return String(v).trim();
}

const estOui = (s: string) => ["oui", "o", "x", "1", "true", "vrai"].includes(normaliser(s));
const choix = (s: string) => s.split(";").map((o) => o.trim()).filter(Boolean);

/// "Pression aspiration (bars)" → "pressionAspirationBars", unique dans la liste.
function nouvelleCle(libelle: string, prises: Set<string>): string {
  const mots = normaliser(libelle).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean);
  let base = mots.map((m, i) => (i === 0 ? m : m[0].toUpperCase() + m.slice(1))).join("") || "champ";
  if (/^[0-9]/.test(base)) base = `c${base}`;
  let cle = base;
  for (let n = 2; prises.has(cle); n++) cle = `${base}${n}`;
  prises.add(cle);
  return cle;
}

type Ligne = Record<string, string>;

/// Lignes d'un onglet, indexées par en-tête normalisé (début de l'en-tête :
/// "Choix (séparés par ;)" est lu sous "choix").
function lireOnglet(workbook: ExcelJS.Workbook, nom: string, entetes: string[]): Ligne[] | null {
  const feuille = workbook.worksheets.find((f) => normaliser(f.name) === normaliser(nom));
  if (!feuille) return null;
  const colonnes = new Map<string, number>();
  feuille.getRow(1).eachCell((cell, col) => {
    const h = normaliser(texte(cell.value));
    for (const e of entetes) if (!colonnes.has(e) && h.startsWith(normaliser(e))) colonnes.set(e, col);
  });
  const lignes: Ligne[] = [];
  feuille.eachRow((row, n) => {
    if (n === 1) return;
    const l: Ligne = {};
    for (const e of entetes) l[e] = colonnes.has(e) ? texte(row.getCell(colonnes.get(e)!).value) : "";
    if (Object.values(l).some((v) => v)) lignes.push(l);
  });
  return lignes;
}

function grouper(lignes: Ligne[], cle: string): Map<string, Ligne[]> {
  const m = new Map<string, Ligne[]>();
  for (const l of lignes) {
    const k = l[cle].trim();
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), l]);
  }
  return m;
}

const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const normChamp = (c: ChampEnTete) => [c.label, c.unite ?? "", Boolean(c.numerique), c.options ?? [], Boolean(c.memeLigneSuivant)];
const normItem = (c: ChecklistItem) => [c.rep, c.label, c.typeValeur ?? "bool", c.typeValeur === "enum" ? (c.options ?? []) : []];

export async function analyserImportFamilles(
  fichier: ArrayBuffer,
  existantes: TypeEquipement[],
): Promise<{ ok: true; resultat: ResultatImportFamilles } | { ok: false; erreur: string }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fichier);
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx est attendu (celui de l'export)." };
  }

  const ongletFamilles = lireOnglet(workbook, "Familles", ["Code", "Nom", "Type Equipement 1", "Repère"]);
  if (!ongletFamilles) return { ok: false, erreur: "Onglet « Familles » introuvable : pars du fichier de l'export." };
  const champsLignes = lireOnglet(workbook, "Champs", ["Code famille", "Ordre", "Libellé", "Unité", "Numérique", "Choix", "Même ligne", "Repère"]) ?? [];
  const listesLignes = lireOnglet(workbook, "Listes", ["Code famille", "Liste", "Sous-champ", "Unité", "Repère liste", "Repère sous-champ"]) ?? [];
  const checklistLignes = lireOnglet(workbook, "Checklist", ["Code famille", "N°", "Opération", "Type de réponse", "Choix"]) ?? [];
  const mesuresLignes = lireOnglet(workbook, "Mesures", ["Code famille", "Groupe", "Répétable", "Nombre max", "Mesure", "Unité", "Repère groupe", "Repère mesure"]) ?? [];

  const avertissements: string[] = [];
  const parCode = new Map(existantes.map((f) => [normaliser(f.code), f]));
  const parId = new Map(existantes.map((f) => [f.id, f]));
  const idsPris = new Set(existantes.map((f) => f.id));

  const champsParFamille = grouper(champsLignes, "Code famille");
  const listesParFamille = grouper(listesLignes, "Code famille");
  const checklistParFamille = grouper(checklistLignes, "Code famille");
  const mesuresParFamille = grouper(mesuresLignes, "Code famille");

  const familles: FamilleImportee[] = [];
  const resumes: ResumeFamille[] = [];
  const codesVus = new Set<string>();

  for (const lf of ongletFamilles) {
    const code = lf["Code"].trim();
    if (!code) continue;
    if (codesVus.has(normaliser(code))) {
      avertissements.push(`Famille « ${code} » en double dans l'onglet Familles : seule la première ligne compte.`);
      continue;
    }
    codesVus.add(normaliser(code));
    const existante = (lf["Repère"] && parId.get(lf["Repère"].trim())) || parCode.get(normaliser(code)) || null;
    const nom = lf["Nom"].trim() || existante?.nom || code;
    let id = existante?.id;
    if (!id) {
      const base = normaliser(code).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "famille";
      id = base;
      for (let n = 2; idsPris.has(id); n++) id = `${base}_${n}`;
      idsPris.add(id);
    }
    const lignesDe = (m: Map<string, Ligne[]>) => m.get(code) ?? [...m.entries()].find(([k]) => normaliser(k) === normaliser(code))?.[1];
    const changements: string[] = [];

    // ---- Champs de fiche
    let champs: ChampEnTete[] = existante?.champs_en_tete_supplementaires ?? [];
    const lc = lignesDe(champsParFamille);
    if (lc) {
      const prises = new Set(champs.map((c) => c.cle));
      const tries = [...lc].sort((a, b) => (Number(a["Ordre"]) || 9999) - (Number(b["Ordre"]) || 9999));
      const nouveaux: ChampEnTete[] = [];
      for (const l of tries) {
        if (!l["Libellé"]) continue;
        const ancien =
          champs.find((c) => l["Repère"] && c.cle === l["Repère"]) ?? champs.find((c) => normaliser(c.label) === normaliser(l["Libellé"]));
        const champ: ChampEnTete = {
          cle: ancien?.cle ?? nouvelleCle(l["Libellé"], prises),
          label: l["Libellé"],
          unite: l["Unité"],
          numerique: estOui(l["Numérique"]),
          options: choix(l["Choix"]),
          memeLigneSuivant: estOui(l["Même ligne"]),
        };
        if (!ancien) changements.push(`Champ ajouté : ${champ.label}`);
        else if (!egal(normChamp(ancien), normChamp(champ))) {
          const retires = (ancien.options ?? []).filter((o) => !champ.options.some((n) => normaliser(n) === normaliser(o)));
          changements.push(
            `Champ modifié : ${champ.label}${retires.length ? ` (choix retirés : ${retires.join(", ")})` : ""}`,
          );
        }
        nouveaux.push(champ);
      }
      const absents = champs.filter((c) => !nouveaux.some((n) => n.cle === c.cle));
      for (const a of absents) avertissements.push(`${code} : champ « ${a.label} » absent du fichier, conservé.`);
      const ordreChange = !egal(
        nouveaux.filter((n) => champs.some((c) => c.cle === n.cle)).map((c) => c.cle),
        champs.filter((c) => nouveaux.some((n) => n.cle === c.cle)).map((c) => c.cle),
      );
      if (ordreChange && existante) changements.push("Ordre des champs modifié");
      champs = [...nouveaux, ...absents];
    }

    // ---- Listes à rallonge
    let listes: ChampListe[] = existante?.champs_listes ?? [];
    const ll = lignesDe(listesParFamille);
    if (ll) {
      const prisesListes = new Set(listes.map((l) => l.cle));
      const resultat: ChampListe[] = listes.map((l) => ({ ...l, sousChamps: l.sousChamps.map((s) => ({ ...s })) }));
      for (const l of ll) {
        if (!l["Liste"] || !l["Sous-champ"]) continue;
        let liste =
          resultat.find((x) => l["Repère liste"] && x.cle === l["Repère liste"]) ?? resultat.find((x) => normaliser(x.label) === normaliser(l["Liste"]));
        if (!liste) {
          liste = { cle: nouvelleCle(l["Liste"], prisesListes), label: l["Liste"], sousChamps: [] };
          resultat.push(liste);
          changements.push(`Liste ajoutée : ${liste.label}`);
        } else if (liste.label !== l["Liste"]) {
          liste.label = l["Liste"];
          changements.push(`Liste renommée : ${liste.label}`);
        }
        const prises = new Set(liste.sousChamps.map((s) => s.cle));
        const sc =
          liste.sousChamps.find((s) => l["Repère sous-champ"] && s.cle === l["Repère sous-champ"]) ??
          liste.sousChamps.find((s) => normaliser(s.label) === normaliser(l["Sous-champ"]));
        if (!sc) {
          liste.sousChamps.push({ cle: nouvelleCle(l["Sous-champ"], prises), label: l["Sous-champ"], unite: l["Unité"] });
          changements.push(`Sous-champ ajouté : ${liste.label} / ${l["Sous-champ"]}`);
        } else if (sc.label !== l["Sous-champ"] || (sc.unite ?? "") !== l["Unité"]) {
          sc.label = l["Sous-champ"];
          sc.unite = l["Unité"];
          changements.push(`Sous-champ modifié : ${liste.label} / ${sc.label}`);
        }
      }
      listes = resultat;
    }

    // ---- Checklist
    let checklist: ChecklistItem[] = existante?.checklist ?? [];
    const lk = lignesDe(checklistParFamille);
    if (lk) {
      const resultat: ChecklistItem[] = [];
      const repsVus = new Set<number>();
      for (const l of lk) {
        const rep = parseInt(l["N°"], 10);
        if (!Number.isInteger(rep) || rep < 1 || !l["Opération"]) {
          avertissements.push(`${code} : ligne de checklist ignorée (n° ou opération manquant).`);
          continue;
        }
        if (repsVus.has(rep)) {
          avertissements.push(`${code} : opération n°${rep} en double, seule la première compte.`);
          continue;
        }
        repsVus.add(rep);
        const t = normaliser(l["Type de réponse"]);
        const typeValeur: ChecklistItem["typeValeur"] = t.startsWith("choix") ? "enum" : t.startsWith("texte") ? "text" : "bool";
        const options = typeValeur === "enum" ? choix(l["Choix"]) : [];
        if (typeValeur === "enum" && options.length === 0) {
          avertissements.push(`${code} : opération n°${rep} de type Choix sans choix, passée en « Fait ».`);
        }
        const item: ChecklistItem = {
          rep,
          label: l["Opération"],
          typeValeur: typeValeur === "enum" && options.length === 0 ? "bool" : typeValeur,
          options,
        };
        const ancienne = checklist.find((c) => c.rep === rep);
        if (!ancienne) changements.push(`Opération ajoutée : ${rep}. ${item.label}`);
        else if (!egal(normItem(ancienne), normItem(item))) changements.push(`Opération modifiée : ${rep}. ${item.label}`);
        resultat.push(item);
      }
      const absentes = checklist.filter((c) => !repsVus.has(c.rep));
      for (const c of absentes) avertissements.push(`${code} : opération n°${c.rep} absente du fichier, conservée.`);
      const communs = (liste: ChecklistItem[]) => liste.filter((c) => repsVus.has(c.rep) && checklist.some((x) => x.rep === c.rep)).map((c) => c.rep);
      if (existante && !egal(communs(resultat), communs(checklist))) changements.push("Ordre des opérations modifié");
      checklist = [...resultat, ...absentes];
    }

    // ---- Mesures
    let mesures: GroupeMesure[] = existante?.groupes_mesures ?? [];
    const lm = lignesDe(mesuresParFamille);
    if (lm) {
      const prisesGroupes = new Set(mesures.map((g) => g.cle));
      const resultat: GroupeMesure[] = mesures.map((g) => ({ ...g, champs: g.champs.map((c) => ({ ...c })) }));
      for (const l of lm) {
        if (!l["Groupe"] || !l["Mesure"]) continue;
        let groupe =
          resultat.find((g) => l["Repère groupe"] && g.cle === l["Repère groupe"]) ?? resultat.find((g) => normaliser(g.label) === normaliser(l["Groupe"]));
        const repetable = estOui(l["Répétable"]);
        const nombreMax = Math.max(1, parseInt(l["Nombre max"], 10) || 1);
        if (!groupe) {
          groupe = { cle: nouvelleCle(l["Groupe"], prisesGroupes), label: l["Groupe"], repetable, nombreMax, champs: [] };
          resultat.push(groupe);
          changements.push(`Groupe de mesures ajouté : ${groupe.label}`);
        } else if (groupe.label !== l["Groupe"] || groupe.repetable !== repetable || groupe.nombreMax !== nombreMax) {
          groupe.label = l["Groupe"];
          groupe.repetable = repetable;
          groupe.nombreMax = nombreMax;
          changements.push(`Groupe de mesures modifié : ${groupe.label}`);
        }
        const prises = new Set(groupe.champs.map((c) => c.cle));
        const m =
          groupe.champs.find((c) => l["Repère mesure"] && c.cle === l["Repère mesure"]) ??
          groupe.champs.find((c) => normaliser(c.label) === normaliser(l["Mesure"]));
        if (!m) {
          groupe.champs.push({ cle: nouvelleCle(l["Mesure"], prises), label: l["Mesure"], unite: l["Unité"] });
          changements.push(`Mesure ajoutée : ${groupe.label} / ${l["Mesure"]}`);
        } else if (m.label !== l["Mesure"] || (m.unite ?? "") !== l["Unité"]) {
          m.label = l["Mesure"];
          m.unite = l["Unité"];
          changements.push(`Mesure modifiée : ${groupe.label} / ${m.label}`);
        }
      }
      mesures = resultat;
    }

    const type1 = lf["Type Equipement 1"].trim();
    if (existante) {
      if (existante.nom !== nom) changements.unshift(`Nom : ${existante.nom} → ${nom}`);
      if (existante.code !== code) changements.unshift(`Code : ${existante.code} → ${code}`);
      if (existante.type_equipement1_fixe !== type1) changements.unshift(`Type Equipement 1 : ${existante.type_equipement1_fixe || "—"} → ${type1 || "—"}`);
    }

    familles.push({
      id,
      code,
      nom,
      type_equipement1_fixe: type1,
      champs_en_tete_supplementaires: champs,
      champs_listes: listes,
      checklist,
      groupes_mesures: mesures,
    });
    resumes.push({ code, nom, nouvelle: !existante, changements });
  }

  for (const [k] of [...champsParFamille, ...listesParFamille, ...checklistParFamille, ...mesuresParFamille]) {
    if (!codesVus.has(normaliser(k))) avertissements.push(`Code famille « ${k} » utilisé dans un onglet mais absent de l'onglet Familles : lignes ignorées.`);
  }
  for (const f of existantes) {
    if (!familles.some((x) => x.id === f.id)) avertissements.push(`Famille ${f.code} absente du fichier : conservée sans changement.`);
  }

  return { ok: true, resultat: { familles, resumes, avertissements: [...new Set(avertissements)] } };
}

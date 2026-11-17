import { z } from "zod";

export type ArticlePU = {
  id: string;
  ordre: number;
  famille: string;
  type: string;
  donnee1: string;
  donnee2: string;
  donnee3: string;
  donnee4: string;
  donnee5: string;
  donnee6: string;
  tarif_net_ht: number | null;
  mo_heures: number | null;
  date_maj_tarif: string | null;
};

export const CHAMP_UNITE = "donnee3" as const;

export const CHAMPS_TEXTE = ["famille", "type", "donnee1", "donnee2", "donnee3", "donnee4", "donnee5", "donnee6"] as const;
export type ChampTextePU = (typeof CHAMPS_TEXTE)[number];

/// Titres du classeur, dans l'ordre du fichier Réferentiel PU.xlsx —
/// mêmes titres à l'écran, à l'export et à l'import. Donnée 3 porte
/// toujours l'unité (Un, ml, Ft) — voir CHAMP_UNITE.
export const TITRES_PU: { cle: ChampTextePU | "tarif_net_ht" | "mo_heures" | "date_maj_tarif"; titre: string }[] = [
  { cle: "famille", titre: "Famille" },
  { cle: "type", titre: "Type" },
  { cle: "donnee1", titre: "Donnée 1" },
  { cle: "donnee2", titre: "Donnée 2" },
  { cle: "donnee3", titre: "Donnée 3" },
  { cle: "donnee4", titre: "Donnée 4" },
  { cle: "donnee5", titre: "Donnée 5" },
  { cle: "donnee6", titre: "Donnée 6" },
  { cle: "tarif_net_ht", titre: "Tarif net HT" },
  { cle: "mo_heures", titre: "MO" },
  { cle: "date_maj_tarif", titre: "Date mise à jour tarif" },
];

const nombreOuVide = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
    return s === "" ? null : s;
  },
  z.coerce.number({ error: "Nombre invalide." }).min(0, "Le nombre doit être positif.").nullable(),
);

export const articlePUSchema = z.object({
  famille: z.string().trim().min(1, "La famille est obligatoire."),
  type: z.string().trim().min(1, "Le type est obligatoire."),
  donnee1: z.string().trim().default(""),
  donnee2: z.string().trim().default(""),
  donnee3: z.string().trim().default(""),
  donnee4: z.string().trim().default(""),
  donnee5: z.string().trim().default(""),
  donnee6: z.string().trim().default(""),
  tarif_net_ht: nombreOuVide,
  mo_heures: nombreOuVide,
  date_maj_tarif: z.preprocess(
    (v) => (v === null || v === undefined || String(v).trim() === "" ? null : dateISO(String(v))),
    z.string({ error: "Date invalide (jj/mm/aaaa attendu)." }).nullable(),
  ),
});
export type ArticlePUInput = z.infer<typeof articlePUSchema>;

/// Accepte jj/mm/aaaa (ou jj-mm-aa) et aaaa-mm-jj ; undefined si illisible.
export function dateISO(v: string): string | undefined {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return undefined;
  const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
  const jour = m[1].padStart(2, "0");
  const mois = m[2].padStart(2, "0");
  const d = new Date(`${annee}-${mois}-${jour}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(jour)) return undefined;
  return `${annee}-${mois}-${jour}`;
}

export function dateFrPU(iso: string | null): string {
  if (!iso) return "";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

export function aujourdhuiISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/// Identité d'un article à l'import : tout sauf le prix et la MO,
/// casse et espaces ignorés.
export function cleArticlePU(a: Pick<ArticlePU, ChampTextePU>): string {
  return CHAMPS_TEXTE.map((c) => String(a[c] ?? "").replace(/\s+/g, " ").trim().toLowerCase()).join("|");
}

export function libelleArticlePU(a: Pick<ArticlePU, ChampTextePU>): string {
  return [a.type, a.donnee1, a.donnee2, a.donnee4, a.donnee5]
    .filter((v) => v && v.trim())
    .map(affichageDonneePU)
    .join(" — ");
}

export function affichageDonneePU(v: string): string {
  return /^-?\d+\.\d+$/.test(v.trim()) ? v.trim().replace(".", ",") : v;
}

export function formatNombrePU(v: number | null, decimales = 2): string {
  if (v === null || v === undefined) return "";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

export const TAUX_HORAIRE_SECOURS = 52;

function normaliserLibelle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function estLigneMainOeuvre(a: Pick<ArticlePU, "famille">): boolean {
  return normaliserLibelle(a.famille) === "main d'oeuvre";
}

/// Taux horaire des devis : Tarif net HT de la ligne Main d'œuvre /
/// « Mise en œuvre ». Absente ou sans tarif : 52 €/h de secours.
export function tauxHoraireDepuisArticles(
  articles: Pick<ArticlePU, "famille" | "type" | "tarif_net_ht">[],
): { taux: number; trouve: boolean } {
  const ligne = articles.find((a) => estLigneMainOeuvre(a) && normaliserLibelle(a.type) === "mise en oeuvre");
  if (!ligne || ligne.tarif_net_ht === null || Number(ligne.tarif_net_ht) <= 0) {
    return { taux: TAUX_HORAIRE_SECOURS, trouve: false };
  }
  return { taux: Number(ligne.tarif_net_ht), trouve: true };
}

/// Désignation d'une ligne de devis : « Type Donnée 1 Donnée 2 Donnée 4 — Donnée 5 »
/// (marque, puissance, tension ; Donnée 3 = unité n'y figure pas).
export function designationArticlePU(a: Pick<ArticlePU, ChampTextePU>): string {
  const base = [a.type, a.donnee1, a.donnee2, a.donnee4]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .map(affichageDonneePU)
    .join(" ");
  const reference = (a.donnee5 ?? "").trim();
  return reference ? `${base} — ${reference}` : base;
}

export function uniteDevisDepuisArticle(a: Pick<ArticlePU, typeof CHAMP_UNITE>): string {
  const u = (a[CHAMP_UNITE] ?? "").trim();
  return !u || u.toLowerCase() === "un" ? "U" : u;
}

export function uniteArticleDepuisDevis(unite: string): string {
  return unite.trim() === "U" ? "Un" : unite.trim();
}

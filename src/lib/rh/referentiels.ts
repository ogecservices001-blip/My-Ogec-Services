/// Référentiel RH : description des tableaux modifiables (colonnes, clé de
/// rapprochement pour l'import Excel). Utilisé côté serveur et côté écran.

export type TypeColonne = "texte" | "nombre" | "euros" | "booleen" | "date" | "choix" | "commune";

export type ColonneRef = {
  cle: string;
  entete: string;
  type: TypeColonne;
  obligatoire?: boolean;
  /// Options d'une colonne "choix" (ou fournies à l'exécution, voir optionsDynamiques).
  options?: { valeur: string; label: string }[];
  optionsDynamiques?: "profils" | "postes_absence";
};

export type CodeReferentiel = "bareme" | "salaries" | "absences" | "jours-feries";

export type DefinitionReferentiel = {
  code: CodeReferentiel;
  titre: string;
  description: string;
  table: "rh_bareme_communes" | "rh_salaries" | "rh_motifs_absence" | "jours_feries";
  /// Colonne identifiant une ligne en base (clé primaire).
  id: string;
  /// Colonne métier unique, qui sert à rapprocher les lignes d'un import.
  cle: string;
  tri: { colonne: string; asc: boolean };
  colonnes: ColonneRef[];
};

export const REFERENTIELS: Record<CodeReferentiel, DefinitionReferentiel> = {
  bareme: {
    code: "bareme",
    titre: "Barème trajets et transports",
    description: "Primes par commune ou quartier, au départ de Saint-Paul.",
    table: "rh_bareme_communes",
    id: "id",
    cle: "commune",
    tri: { colonne: "commune", asc: true },
    colonnes: [
      { cle: "commune", entete: "Commune", type: "commune", obligatoire: true },
      { cle: "prime_trajet", entete: "Prime trajet (€)", type: "euros" },
      { cle: "prime_transport", entete: "Prime transport (€)", type: "euros" },
      { cle: "date_valeur", entete: "Date de valeur", type: "date" },
    ],
  },
  salaries: {
    code: "salaries",
    titre: "Salariés",
    description: "Nom pour la paie et catégorie de chaque salarié.",
    table: "rh_salaries",
    id: "id",
    cle: "nom_paie",
    tri: { colonne: "nom_paie", asc: true },
    colonnes: [
      { cle: "nom_paie", entete: "Nom pour la paie", type: "texte", obligatoire: true },
      { cle: "profile_id", entete: "Compte dans l'application", type: "choix", optionsDynamiques: "profils" },
      {
        cle: "categorie",
        entete: "Catégorie",
        type: "choix",
        obligatoire: true,
        options: [
          { valeur: "technique", label: "Technique" },
          { valeur: "administratif", label: "Administratif" },
        ],
      },
      { cle: "actif", entete: "Actif", type: "booleen" },
    ],
  },
  absences: {
    code: "absences",
    titre: "Motifs d'absence",
    description: "Motifs d'absence, code paie, et poste « Absence » du planning correspondant.",
    table: "rh_motifs_absence",
    id: "id",
    cle: "motif",
    tri: { colonne: "ordre", asc: true },
    colonnes: [
      { cle: "motif", entete: "Motif", type: "texte", obligatoire: true },
      { cle: "code_paie", entete: "Code paie", type: "texte" },
      { cle: "poste_hors_client_id", entete: "Poste du planning", type: "choix", optionsDynamiques: "postes_absence" },
      { cle: "exclu_comptage_heures", entete: "Exclu du comptage des heures", type: "booleen" },
      { cle: "exclu_panier", entete: "Pas de panier", type: "booleen" },
    ],
  },
  "jours-feries": {
    code: "jours-feries",
    titre: "Jours fériés",
    description: "Jours fériés de La Réunion : heures à 100 %, pas d'intervention client.",
    table: "jours_feries",
    id: "date",
    cle: "date",
    tri: { colonne: "date", asc: true },
    colonnes: [
      { cle: "date", entete: "Date", type: "date", obligatoire: true },
      { cle: "libelle", entete: "Jour férié", type: "texte", obligatoire: true },
    ],
  },
};

export const normaliserCle = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bste\b/g, "sainte")
    .replace(/\bst\b/g, "saint")
    .replace(/[^a-z0-9]/g, "");

const MOTS_MINUSCULES = new Set(["de", "des", "du", "la", "le", "les", "d", "l"]);

/// Commune au bon format : espaces nettoyés, majuscule à chaque mot (sauf
/// articles en milieu de nom). Si la commune existe déjà dans les adresses
/// des sites, c'est leur orthographe qui est reprise.
export function formaterCommune(saisie: string, communesSites: string[] = []): string {
  const propre = saisie.replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").replace(/\s*'\s*/g, "'").trim();
  const sansArticle = (s: string) => normaliserCle(s).replace(/^(les|la|le|l)(?=[a-z]{3})/, "");
  const existante =
    communesSites.find((c) => normaliserCle(c) === normaliserCle(propre)) ?? communesSites.find((c) => sansArticle(c) === sansArticle(propre));
  if (existante) return existante;
  let index = 0;
  return propre
    .split(/([ '-])/)
    .map((mot) => {
      if (mot === " " || mot === "-" || mot === "'") return mot;
      const bas = mot.toLowerCase();
      const premier = index++ === 0;
      if (!premier && MOTS_MINUSCULES.has(bas)) return bas;
      return bas.charAt(0).toUpperCase() + bas.slice(1);
    })
    .join("");
}

/// Valeur saisie (écran ou Excel) → valeur à enregistrer, ou erreur.
export function convertirValeur(col: ColonneRef, brut: unknown): { ok: true; valeur: unknown } | { ok: false; erreur: string } {
  const texte = brut instanceof Date ? brut.toISOString().slice(0, 10) : String(brut ?? "").trim();
  if (!texte) {
    if (col.obligatoire) return { ok: false, erreur: `${col.entete} est obligatoire.` };
    if (col.type === "nombre" || col.type === "euros") return { ok: true, valeur: 0 };
    if (col.type === "booleen") return { ok: true, valeur: false };
    return { ok: true, valeur: col.type === "texte" || col.type === "commune" ? "" : null };
  }
  switch (col.type) {
    case "nombre":
    case "euros": {
      const n = Number(texte.replace(/\s|€/g, "").replace(",", "."));
      return Number.isFinite(n) ? { ok: true, valeur: Math.round(n * 100) / 100 } : { ok: false, erreur: `${col.entete} : « ${texte} » n'est pas un nombre.` };
    }
    case "booleen":
      return { ok: true, valeur: ["oui", "o", "x", "1", "true", "vrai"].includes(texte.toLowerCase()) };
    case "date": {
      const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texte);
      const iso = fr ? `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}` : texte.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? { ok: true, valeur: iso } : { ok: false, erreur: `${col.entete} : date « ${texte} » invalide (jj/mm/aaaa).` };
    }
    default:
      return { ok: true, valeur: texte };
  }
}

/// Valeur enregistrée → texte affiché (écran, Excel, rapport).
export function afficherValeur(col: ColonneRef, valeur: unknown, options: { valeur: string; label: string }[] = []): string {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  switch (col.type) {
    case "euros":
      return Number(valeur).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "booleen":
      return valeur ? "Oui" : "Non";
    case "date":
      return String(valeur).slice(0, 10).split("-").reverse().join("/");
    case "choix":
      return (col.options ?? options).find((o) => o.valeur === valeur)?.label ?? String(valeur);
    default:
      return String(valeur);
  }
}

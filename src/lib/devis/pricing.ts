/// Port du calcul de prix du classeur Excel "Devis MOD.xlsm" (feuilles
/// "Mdle Devis" et "Feuille Vente") — coût de revient détaillé en 5
/// blocs (R1 Fourniture/Sous-traitance, R2 Montage, R3 Chantier, R4
/// Études, R5 Frais divers en % du prix de vente) → marge cible → prix
/// de vente → coefficient de vente appliqué ligne par ligne. Simplifié
/// une fois : "Paniers" (R3) était calculé depuis des cellules non
/// portées (nb jours/techniciens) dans le classeur, devient une saisie
/// manuelle en euros comme les autres lignes de R3.

export type TypeLigneDevis = "normal" | "sous_traitant" | "code2";

export type LigneDevis = {
  designation: string;
  unite: string;
  quantite: string;
  matiere: string;
  moHeures: string;
  type: TypeLigneDevis;
};

export function ligneDevisVide(): LigneDevis {
  return { designation: "", unite: "U", quantite: "1", matiere: "", moHeures: "", type: "normal" };
}

export type CoutRevient = {
  r1SousTraitance: string;
  r1Divers: string;
  r2TauxHoraire: string;
  r3Nacelle: string;
  r3Deplacement: string;
  r3Outillage: string;
  r3Manutention: string;
  r3Encadrement: string;
  r3Essais: string;
  r3GarantieSav: string;
  r3Paniers: string;
  r4SyntheseEtudes: string;
  r4TirageDePlans: string;
  r4DessinSousTraite: string;
  r4Encadrement: string;
  r4BilanThermique: string;
  r5CautionnementPct: string;
  r5ContratEntretienPct: string;
  r5FournituresAdminPct: string;
  r5CompteProrataPct: string;
  r5EpiPct: string;
  r5EssaisCoprecPct: string;
  r5FormationsPct: string;
  r5AssurancesPct: string;
  r5FraisCommerciauxPct: string;
  r5DecennalePct: string;
  margeCiblePct: string;
};

/// Mêmes valeurs par défaut que le classeur source.
export function coutRevientDefaut(): CoutRevient {
  return {
    r1SousTraitance: "",
    r1Divers: "",
    r2TauxHoraire: "52",
    r3Nacelle: "",
    r3Deplacement: "",
    r3Outillage: "",
    r3Manutention: "",
    r3Encadrement: "",
    r3Essais: "",
    r3GarantieSav: "",
    r3Paniers: "",
    r4SyntheseEtudes: "",
    r4TirageDePlans: "",
    r4DessinSousTraite: "",
    r4Encadrement: "",
    r4BilanThermique: "",
    r5CautionnementPct: "0",
    r5ContratEntretienPct: "0",
    r5FournituresAdminPct: "0.2",
    r5CompteProrataPct: "0",
    r5EpiPct: "0.2",
    r5EssaisCoprecPct: "0.2",
    r5FormationsPct: "0.2",
    r5AssurancesPct: "0.5",
    r5FraisCommerciauxPct: "2.5",
    r5DecennalePct: "2.5",
    margeCiblePct: "20",
  };
}

function n(v: string | undefined): number {
  const x = parseFloat((v ?? "").trim().replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

export type CalculPrixRevient = {
  materiel: number;
  heuresMO: number;
  tauxHoraire: number;
  r1Total: number;
  r2Total: number;
  r3Total: number;
  r4Total: number;
  coutAvantFraisDivers: number;
  sommePourcentages: number;
  prixDeVente: number;
  coefficientVente: number;
  r5Total: number;
  margeBrute: number;
};

const CLES_R5: (keyof CoutRevient)[] = [
  "r5CautionnementPct",
  "r5ContratEntretienPct",
  "r5FournituresAdminPct",
  "r5CompteProrataPct",
  "r5EpiPct",
  "r5EssaisCoprecPct",
  "r5FormationsPct",
  "r5AssurancesPct",
  "r5FraisCommerciauxPct",
  "r5DecennalePct",
];

/// Port de la "RECAPITULATION PRIX DE REVIENT" (Feuille Vente!H27:H44).
export function calculerPrixRevient(lignes: LigneDevis[], c: CoutRevient): CalculPrixRevient {
  const materiel = lignes.reduce((s, l) => s + n(l.matiere), 0);
  const heuresMO = lignes.reduce((s, l) => s + n(l.moHeures), 0);
  const tauxHoraire = n(c.r2TauxHoraire);

  const r1Total = materiel + n(c.r1SousTraitance) + n(c.r1Divers);
  const r2Total = heuresMO * tauxHoraire;
  const r3Total =
    n(c.r3Nacelle) +
    n(c.r3Deplacement) +
    n(c.r3Outillage) +
    n(c.r3Manutention) +
    n(c.r3Encadrement) +
    n(c.r3Essais) +
    n(c.r3GarantieSav) +
    n(c.r3Paniers);
  const r4Total =
    n(c.r4SyntheseEtudes) + n(c.r4TirageDePlans) + n(c.r4DessinSousTraite) + n(c.r4Encadrement) + n(c.r4BilanThermique);

  const coutAvantFraisDivers = r1Total + r2Total + r3Total + r4Total;

  const pctR5 = CLES_R5.reduce((s, cle) => s + n(c[cle]), 0);
  const margeCiblePct = n(c.margeCiblePct);
  const sommePourcentages = pctR5 + margeCiblePct;

  const diviseur = 100 - sommePourcentages;
  const prixDeVente = diviseur > 0 ? Math.round((100 * coutAvantFraisDivers) / diviseur) : 0;

  const r5Total = Math.round(prixDeVente * pctR5) / 100;
  const margeBrute = Math.round(prixDeVente * margeCiblePct) / 100;

  // K = Prix de vente / (Matière + Sous-traitance + Montant Main d'œuvre)
  const denominateurCoef = materiel + n(c.r1SousTraitance) + r2Total;
  const coefficientVente = denominateurCoef > 0 ? Math.round((prixDeVente / denominateurCoef) * 100000) / 100000 : 1;

  return {
    materiel,
    heuresMO,
    tauxHoraire,
    r1Total,
    r2Total,
    r3Total,
    r4Total,
    coutAvantFraisDivers,
    sommePourcentages,
    prixDeVente,
    coefficientVente,
    r5Total,
    margeBrute,
  };
}

/// Port de la formule partagée I13 ("Mdle Devis") : coefficient général
/// pour une ligne normale, 1,25 pour une ligne sous-traitée, 1,15 pour
/// une ligne "Code N°2".
export function prixUniteLigne(ligne: LigneDevis, coefficient: number, tauxHoraire: number): number | null {
  if (!ligne.quantite.trim()) return null;
  const base = n(ligne.matiere) + n(ligne.moHeures) * tauxHoraire;
  if (ligne.type === "sous_traitant") return Math.round(base * 1.25 * 100) / 100;
  if (ligne.type === "code2") return Math.round(base * 1.15 * 100) / 100;
  return Math.round(base * coefficient * 10) / 10;
}

export function montantLigneDevis(ligne: LigneDevis, coefficient: number, tauxHoraire: number): number | null {
  const pu = prixUniteLigne(ligne, coefficient, tauxHoraire);
  if (pu === null) return null;
  return n(ligne.quantite) * pu;
}

/// Total HT "bordereau" (somme des lignes) — à comparer au Prix de
/// vente calculé par la Feuille de vente, pas forcément identique
/// (écarts d'arrondi ligne à ligne), même principe que "Calculé
/// bordereau" vs "Feuille de vente" dans le classeur source.
export function totalHTLignes(lignes: LigneDevis[], coefficient: number, tauxHoraire: number): number {
  return lignes.reduce((s, l) => s + (montantLigneDevis(l, coefficient, tauxHoraire) ?? 0), 0);
}

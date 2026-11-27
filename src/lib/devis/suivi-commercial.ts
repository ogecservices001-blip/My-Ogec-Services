/// Suivi commercial des devis : validité de l'offre, rappel de relance
/// (choisi par le bureau, à 1 mois), devis refusés / perdus et taux de
/// transformation.

export const DELAI_RELANCE_MOIS = 1;
export const CHOIX_VALIDITE_MOIS = [1, 2, 3, 6, 12];

export const MOTIFS_PERTE = [
  "Prix trop élevé",
  "Concurrent retenu",
  "Projet abandonné ou reporté",
  "Sans réponse du client",
  "Autre",
];

export type Relance = { date: string; par: string; note: string };

/// « 26/11/2026 » → « 2026-11-26 » ; vide si illisible.
export function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function frDepuisIso(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-");
  return a && m && j ? `${j}/${m}/${a}` : "";
}

/// Même jour N mois plus tard (31/01 + 1 mois → 28 ou 29/02).
export function ajouterMois(iso: string, mois: number): string {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1));
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernierJour));
  return cible.toISOString().slice(0, 10);
}

/// Date du jour à La Réunion (le serveur tourne en UTC).
export function aujourdhuiReunion(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date());
}

/// Fin de validité de l'offre, comptée depuis la date du devis.
export function finValidite(dateDevis: string, validiteMois: number): string {
  const depuis = isoDepuisFr(dateDevis);
  return depuis ? ajouterMois(depuis, validiteMois || 1) : "";
}

export function libelleValidite(mois: number | null | undefined): string {
  mois = mois || 1;
  return mois === 12 ? "1 an" : `${mois} mois`;
}

export type LigneTransformation = {
  annee: string;
  montant: number | null;
  gagne: boolean;
  perdu: boolean;
  motifPerte: string;
};

export type Transformation = {
  annee: string;
  envoyes: number;
  gagnes: number;
  perdus: number;
  enAttente: number;
  tauxNombre: number | null;
  montantEnvoye: number;
  montantGagne: number;
  tauxMontant: number | null;
  motifs: { motif: string; nombre: number }[];
};

/// Devis numérotés et non annulés d'une année (date du devis). Gagné =
/// commandé, réalisé ou facturable.
export function transformation(lignes: LigneTransformation[], annee: string): Transformation {
  const devis = lignes.filter((l) => l.annee === annee);
  const gagnes = devis.filter((l) => l.gagne);
  const perdus = devis.filter((l) => !l.gagne && l.perdu);
  const montantEnvoye = devis.reduce((t, l) => t + (l.montant ?? 0), 0);
  const montantGagne = gagnes.reduce((t, l) => t + (l.montant ?? 0), 0);
  const parMotif = new Map<string, number>();
  for (const l of perdus) parMotif.set(l.motifPerte || "Non précisé", (parMotif.get(l.motifPerte || "Non précisé") ?? 0) + 1);
  return {
    annee,
    envoyes: devis.length,
    gagnes: gagnes.length,
    perdus: perdus.length,
    enAttente: devis.length - gagnes.length - perdus.length,
    tauxNombre: devis.length ? Math.round((gagnes.length / devis.length) * 100) : null,
    montantEnvoye,
    montantGagne,
    tauxMontant: montantEnvoye > 0 ? Math.round((montantGagne / montantEnvoye) * 100) : null,
    motifs: [...parMotif.entries()].map(([motif, nombre]) => ({ motif, nombre })).sort((a, b) => b.nombre - a.nombre),
  };
}

/// Le motif complet « Autre : précision » est rangé sous « Autre ».
export function motifPrincipal(motif: string): string {
  return MOTIFS_PERTE.find((m) => motif === m || motif.startsWith(`${m} :`)) ?? (motif ? "Autre" : "");
}

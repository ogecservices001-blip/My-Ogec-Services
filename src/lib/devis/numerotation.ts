import { extraireNumero } from "@/lib/gmao/equipement-import";

/// "D-26-279-BG-362-32-10" : type, année, chrono de l'année, initiales de
/// celui qui crée, n° client (3 chiffres), n° site (2 chiffres), nature.
export function formaterNumeroDevis(p: {
  annee: string;
  chrono: number;
  initiales: string;
  client: number;
  site: number;
  nature: string;
}): string {
  return [
    "D",
    p.annee,
    String(p.chrono).padStart(3, "0"),
    p.initiales,
    String(p.client).padStart(3, "0"),
    String(p.site).padStart(2, "0"),
    p.nature,
  ].join("-");
}

/// N° client et n° site tirés du N° Affaire du site ("362-32").
export function numeroAffaireDuSite(nAffaire: string): { client: number; site: number } | null {
  const [brutClient, brutSite] = nAffaire.split("-");
  const client = extraireNumero(brutClient ?? "");
  const site = extraireNumero(brutSite ?? "");
  if (client === null || site === null) return null;
  return { client, site };
}

/// Le nom est enregistré "NOM Prénom" (ex. "GAUDIN Bruno") — les
/// initiales voulues sont dans l'ordre prénom-nom ("BG"), donc le
/// dernier mot d'abord.
export function initialesDe(nomComplet: string): string {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "";
  const prenom = mots[mots.length - 1][0];
  const nom = mots.length > 1 ? mots[0][0] : "";
  return `${prenom}${nom}`.toUpperCase();
}

/// Plus haut chrono déjà attribué pour l'année, + 1.
export function prochainChrono(numerosExistants: string[], annee: string): number {
  let max = 0;
  for (const numero of numerosExistants) {
    const parties = numero.split("-");
    if (parties[0] !== "D" || parties[1] !== annee) continue;
    const chrono = Number(parties[2]);
    if (Number.isFinite(chrono) && chrono > max) max = chrono;
  }
  return max + 1;
}

/// Contacts d'une fiche site (sans dépendance serveur : utilisable partout).

export const normaliserEmail = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function emailValide(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}


export const CHAMPS_CONTACTS = [
  { courriel: "courriel_interlocuteur_site", nom: "interlocuteur_site", role: "Interlocuteur site 1" },
  { courriel: "courriel_interlocuteur_site_2", nom: "interlocuteur_site_2", role: "Interlocuteur site 2" },
  { courriel: "courriel_interlocuteur_site_3", nom: "interlocuteur_site_3", role: "Interlocuteur site 3" },
  { courriel: "courriel_interlocuteur_site_4", nom: "interlocuteur_site_4", role: "Interlocuteur site 4" },
  { courriel: "courriel_responsable", nom: "responsable_contrat", role: "Responsable contrat" },
  { courriel: "courriel_tiers", nom: "interlocuteur_tiers", role: "Tiers" },
  { courriel: "courriel_interlocuteur_facturation", nom: "interlocuteur_facturation", role: "Facturation" },
] as const;

export type ContactSite = { email: string; nom: string; role: string };

/// Contacts de la fiche site ayant une adresse (une case à plusieurs
/// adresses donne plusieurs contacts).
export function contactsDuSite(site: Record<string, unknown>): ContactSite[] {
  const vus = new Map<string, ContactSite>();
  for (const c of CHAMPS_CONTACTS) {
    for (const brut of String(site[c.courriel] ?? "").split(/[;,\s]+/)) {
      const email = normaliserEmail(brut);
      if (!emailValide(email) || vus.has(email)) continue;
      vus.set(email, { email, nom: String(site[c.nom] ?? "").trim(), role: c.role });
    }
  }
  return [...vus.values()];
}

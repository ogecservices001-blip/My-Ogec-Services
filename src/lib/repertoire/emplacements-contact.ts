export type EmplacementContact = "site1" | "site2" | "site3" | "site4" | "responsable" | "facturation" | "tiers";

export type ContactSite = { nom: string; fixe: string; portable: string; courriel: string };

/// Colonnes de la table sites pour chaque emplacement de contact : nom,
/// téléphone fixe, portable, courriel.
export const EMPLACEMENTS_CONTACT: { valeur: EmplacementContact; libelle: string; colonnes: [string, string, string, string] }[] = [
  {
    valeur: "site1",
    libelle: "Interlocuteur site 1",
    colonnes: ["interlocuteur_site", "tel_fixe_interlocuteur_site", "portable_interlocuteur_site", "courriel_interlocuteur_site"],
  },
  ...[2, 3, 4].map((n) => ({
    valeur: `site${n}` as EmplacementContact,
    libelle: `Interlocuteur site ${n}`,
    colonnes: [
      `interlocuteur_site_${n}`,
      `tel_fixe_interlocuteur_site_${n}`,
      `portable_interlocuteur_site_${n}`,
      `courriel_interlocuteur_site_${n}`,
    ] as [string, string, string, string],
  })),
  {
    valeur: "responsable",
    libelle: "Responsable contrat",
    colonnes: ["responsable_contrat", "tel_fixe_responsable", "portable_responsable", "courriel_responsable"],
  },
  {
    valeur: "facturation",
    libelle: "Facturation",
    colonnes: [
      "interlocuteur_facturation",
      "tel_fixe_interlocuteur_facturation",
      "portable_interlocuteur_facturation",
      "courriel_interlocuteur_facturation",
    ],
  },
  {
    valeur: "tiers",
    libelle: "Tiers",
    colonnes: ["interlocuteur_tiers", "tel_fixe_tiers", "portable_tiers", "courriel_tiers"],
  },
];

export function contactDeLEmplacement(site: Record<string, unknown>, emplacement: EmplacementContact): ContactSite {
  const e = EMPLACEMENTS_CONTACT.find((x) => x.valeur === emplacement)!;
  const [nom, fixe, portable, courriel] = e.colonnes.map((c) => String(site[c] ?? "").trim());
  return { nom, fixe, portable, courriel };
}

export function contactVide(c: ContactSite): boolean {
  return !c.nom && !c.fixe && !c.portable && !c.courriel;
}

import { EMPLACEMENTS_CONTACT, contactDeLEmplacement, type EmplacementContact } from "./emplacements-contact";

export type ContactCourriel = { role: string; nom: string; email: string };

/// Contacts d'un site ayant un courriel (interlocuteurs 1 à 4, responsable
/// contrat, facturation, tiers), sans doublon d'adresse : une même adresse
/// sur plusieurs emplacements n'apparaît qu'une fois, avec tous ses rôles.
export function contactsAvecCourriel(
  site: Record<string, unknown> | null | undefined,
  sauf: EmplacementContact[] = [],
): ContactCourriel[] {
  if (!site) return [];
  const parEmail = new Map<string, ContactCourriel>();
  for (const e of EMPLACEMENTS_CONTACT) {
    if (sauf.includes(e.valeur)) continue;
    const c = contactDeLEmplacement(site, e.valeur);
    if (!c.courriel) continue;
    const cle = c.courriel.toLowerCase();
    const deja = parEmail.get(cle);
    if (deja) deja.role = `${deja.role}, ${e.libelle}`;
    else parEmail.set(cle, { role: e.libelle, nom: c.nom, email: c.courriel });
  }
  return [...parEmail.values()];
}

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValide(email: string): boolean {
  return FORMAT_EMAIL.test(email.trim());
}

/// Nettoie la liste cochée avant envoi : espaces, doublons, adresses
/// invalides refusées, au moins un destinataire.
export function validerDestinataires(liste: string[]): { ok: true; emails: string[] } | { ok: false; erreur: string } {
  const vus = new Set<string>();
  const emails: string[] = [];
  for (const brut of liste) {
    const email = brut.trim();
    if (!email || vus.has(email.toLowerCase())) continue;
    if (!emailValide(email)) return { ok: false, erreur: `Adresse email invalide : ${email}` };
    vus.add(email.toLowerCase());
    emails.push(email);
  }
  if (emails.length === 0) return { ok: false, erreur: "Coche au moins un destinataire." };
  return { ok: true, emails };
}

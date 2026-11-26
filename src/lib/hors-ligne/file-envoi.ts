"use client";

import { estErreurReseau, listerEnvois, majEnvoi, supprimerEnvoi, type Envoi } from "./stockage";

export type ResultatTraitement = { ok: true; message?: string } | { ok: false; erreur: string };
type Traitement = (payload: unknown, envoi: Envoi) => Promise<ResultatTraitement>;

const traitements = new Map<string, Traitement>();
const abonnes = new Set<(libelle: string, message?: string) => void>();
let enCours: Promise<void> | null = null;

/// Chaque type d'envoi (« cerfa », « releve », « bi ») déclare comment
/// s'envoyer au serveur une fois le réseau revenu.
export function enregistrerTraitement(type: string, traitement: Traitement) {
  traitements.set(type, traitement);
}

/// Prévenu à chaque envoi réussi (pastille « Envoyé ✓ »).
export function surEnvoiReussi(abonne: (libelle: string, message?: string) => void): () => void {
  abonnes.add(abonne);
  return () => abonnes.delete(abonne);
}

/// Envoie, dans l'ordre, tout ce qui attend. S'arrête au premier problème de
/// réseau (inutile d'insister) ; un refus du serveur est gardé avec son
/// message pour que l'utilisateur décide (réessayer ou supprimer).
export function traiterFile(inclureEnErreur = false): Promise<void> {
  if (enCours) return enCours;
  // Démarrage différé : le passage ne commence qu'une fois enCours posé, sinon
  // un arrêt immédiat (hors ligne) libérerait le verrou avant qu'il soit pris
  // et bloquerait la file pour toujours.
  enCours = Promise.resolve()
    .then(() => executer(inclureEnErreur))
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

async function executer(inclureEnErreur: boolean): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  for (const envoi of await listerEnvois()) {
    if (envoi.erreur && !inclureEnErreur) continue;
    const traitement = traitements.get(envoi.type);
    if (!traitement) continue;
    try {
      const r = await traitement(envoi.payload, envoi);
      if (r.ok) {
        await supprimerEnvoi(envoi.id);
        abonnes.forEach((a) => a(envoi.libelle, r.message));
      } else {
        await majEnvoi({ ...envoi, tentatives: envoi.tentatives + 1, erreur: r.erreur });
      }
    } catch (e) {
      if (estErreurReseau(e)) {
        await majEnvoi({ ...envoi, tentatives: envoi.tentatives + 1, erreur: null });
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      // Session expirée pendant que le téléphone était hors réseau.
      const erreur = /NEXT_REDIRECT|login/i.test(message) ? "Session expirée : reconnecte-toi, puis Réessayer." : message;
      await majEnvoi({ ...envoi, tentatives: envoi.tentatives + 1, erreur });
    }
  }
}

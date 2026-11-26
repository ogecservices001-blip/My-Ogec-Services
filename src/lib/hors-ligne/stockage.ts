"use client";

/// Stockage sur le téléphone (IndexedDB) pour le travail sans réseau :
/// - « brouillons » : la saisie en cours d'un BI, d'un relevé, d'un CERFA,
///   gardée en continu pour la retrouver après un rechargement ;
/// - « envois » : les validations faites sans réseau, envoyées dès que le
///   réseau revient (voir file-envoi.ts) ;
/// - « fichiers » : les photos prises sans réseau.

const NOM_BASE = "ogec-hors-ligne";
const VERSION = 1;
export const EVENEMENT_CHANGEMENT = "ogec-hors-ligne-change";

export type Brouillon<T = unknown> = { cle: string; libelle: string; donnees: T; majLe: string };

export type Envoi<T = unknown> = {
  id: string;
  type: string;
  libelle: string;
  payload: T;
  creeLe: string;
  /// Ordre d'envoi strict, même pour deux saisies de la même milliseconde.
  ordre: number;
  tentatives: number;
  /// Refus du serveur (pas un problème de réseau) : l'envoi reste en
  /// attente d'une décision de l'utilisateur.
  erreur: string | null;
};

let ouverture: Promise<IDBDatabase> | null = null;
let sequence = 0;

function base(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Stockage local indisponible"));
  ouverture ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM_BASE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("brouillons")) db.createObjectStore("brouillons", { keyPath: "cle" });
      if (!db.objectStoreNames.contains("envois")) db.createObjectStore("envois", { keyPath: "id" });
      if (!db.objectStoreNames.contains("fichiers")) db.createObjectStore("fichiers");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      ouverture = null;
      reject(req.error);
    };
  });
  return ouverture;
}

async function requete<T>(magasin: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await base();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(magasin, mode);
    const req = action(tx.objectStore(magasin));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function signalerChangement() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_CHANGEMENT));
}

export async function lireBrouillon<T>(cle: string): Promise<Brouillon<T> | null> {
  try {
    return ((await requete<Brouillon<T> | undefined>("brouillons", "readonly", (s) => s.get(cle))) ?? null);
  } catch {
    return null;
  }
}

export async function ecrireBrouillon<T>(cle: string, libelle: string, donnees: T): Promise<void> {
  try {
    await requete("brouillons", "readwrite", (s) => s.put({ cle, libelle, donnees, majLe: new Date().toISOString() }));
  } catch {
    // Stockage plein ou indisponible (navigation privée) : la saisie
    // continue normalement, seule la sauvegarde de secours est perdue.
  }
}

export async function effacerBrouillon(cle: string): Promise<void> {
  try {
    await requete("brouillons", "readwrite", (s) => s.delete(cle));
  } catch {
    // idem
  }
}

export async function ajouterEnvoi<T>(type: string, libelle: string, payload: T): Promise<string> {
  const envoi: Envoi<T> = {
    id: crypto.randomUUID(),
    type,
    libelle,
    payload,
    creeLe: new Date().toISOString(),
    ordre: Date.now() * 1000 + (sequence++ % 1000),
    tentatives: 0,
    erreur: null,
  };
  await requete("envois", "readwrite", (s) => s.put(envoi));
  signalerChangement();
  return envoi.id;
}

export async function listerEnvois(): Promise<Envoi[]> {
  try {
    const liste = await requete<Envoi[]>("envois", "readonly", (s) => s.getAll());
    return liste.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.creeLe.localeCompare(b.creeLe));
  } catch {
    return [];
  }
}

export async function majEnvoi(envoi: Envoi): Promise<void> {
  await requete("envois", "readwrite", (s) => s.put(envoi));
  signalerChangement();
}

export async function supprimerEnvoi(id: string): Promise<void> {
  await requete("envois", "readwrite", (s) => s.delete(id));
  signalerChangement();
}

export async function ecrireFichier(id: string, fichier: Blob): Promise<void> {
  await requete("fichiers", "readwrite", (s) => s.put(fichier, id));
}

export async function lireFichier(id: string): Promise<Blob | null> {
  try {
    return ((await requete<Blob | undefined>("fichiers", "readonly", (s) => s.get(id))) ?? null);
  } catch {
    return null;
  }
}

export async function effacerFichier(id: string): Promise<void> {
  try {
    await requete("fichiers", "readwrite", (s) => s.delete(id));
  } catch {
    // idem
  }
}

/// Un appel au serveur qui échoue faute de réseau lève une exception (et non
/// une réponse { ok: false }) : c'est ce qui distingue « pas de réseau » d'un
/// refus du serveur.
export function estErreurReseau(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /fetch|network|réseau|load failed|connexion|timeout|offline/i.test(message);
}

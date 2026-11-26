"use client";

import { createClient } from "@/lib/supabase/client";
import { effacerFichier, lireFichier } from "./stockage";
import type { BiInput, BrouillonBI, PhotoInput } from "@/app/(app)/bi/nouveau/actions";

/// BI en cours de saisie gardé sur le téléphone (un seul à la fois).
export const CLE_BROUILLON_BI = "bi:en-cours";

/// Photo du BI : `local_id` = copie gardée sur le téléphone, envoyée plus
/// tard si la photo a été prise sans réseau (storage_path encore vide).
export type PhotoBI = PhotoInput & { local_id?: string };

export const clePhoto = (localId: string) => `bi-photo:${localId}`;

/// Ce que BrouillonBI ne porte pas et qu'il faut pour reprendre la saisie
/// exactement où elle en était.
export type ExtrasLocaux = {
  etape: number;
  sansDevis: boolean;
  retour: string | null;
  cleEnvoi: string;
  nonDesservisIds: string[];
  motifs: Record<string, string>;
  devisAEtablir: boolean | null;
  etatHorsService: boolean | null;
  tempsManuel: boolean;
  deplacementsManuel: boolean;
  visiteModifiee: boolean;
  nombreDeplacements: number | "";
  sigTech: string;
  sigClient: string;
};

export type InstantaneBI = { brouillon: Omit<BrouillonBI, "photos"> & { photos: (PhotoBI & { preview: string })[] }; extras: ExtrasLocaux };

/// BI transmis sans réseau : envoyé au bureau dès le retour du réseau.
export type BiEnAttente = { input: BiInput; photos: PhotoBI[]; brouillonId: string | null };

function dejaEnvoyee(e: unknown): boolean {
  const x = e as { statusCode?: string | number; message?: string };
  return String(x?.statusCode) === "409" || /already exists|duplicate/i.test(x?.message ?? "");
}

/// Envoie une photo gardée sur le téléphone (renvoi sans risque : une photo
/// déjà arrivée n'est pas recréée). `null` si la copie locale a disparu.
export async function televerserPhoto(localId: string, blob?: Blob | null): Promise<string | null> {
  const fichier = blob ?? (await lireFichier(clePhoto(localId)));
  if (!fichier) return null;
  const chemin = `${localId}.jpg`;
  const { error } = await createClient().storage.from("bi-photos").upload(chemin, fichier, { contentType: "image/jpeg" });
  if (error && !dejaEnvoyee(error)) throw error;
  return chemin;
}

/// Photos prises sans réseau : envoyées avant le BI. Une coupure remonte en
/// erreur ; une photo dont la copie locale a disparu est retirée.
export async function televerserPhotosLocales<T extends PhotoBI>(photos: T[]): Promise<T[]> {
  const resultat: T[] = [];
  for (const p of photos) {
    if (p.storage_path || !p.local_id) {
      resultat.push(p);
      continue;
    }
    const chemin = await televerserPhoto(p.local_id);
    if (chemin) resultat.push({ ...p, storage_path: chemin });
  }
  return resultat;
}

export async function effacerPhotosLocales(photos: PhotoBI[]): Promise<void> {
  for (const p of photos) if (p.local_id) await effacerFichier(clePhoto(p.local_id));
}

/// Seules les photos réellement envoyées partent avec le BI.
export function photosServeur(photos: PhotoBI[]): PhotoInput[] {
  return photos.filter((p) => p.storage_path).map(({ type, storage_path, horodatage }) => ({ type, storage_path, horodatage }));
}

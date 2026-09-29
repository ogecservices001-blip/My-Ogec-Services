"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

/// Bouton "scanner" à poser à côté d'un champ texte (référence, n° de
/// série...) — prend une photo de l'étiquette/plaque signalétique et
/// propose au technicien les lignes de texte reconnues pour remplir le
/// champ. Port web de ocr_scan_button.dart : Google ML Kit (natif) →
/// Google Cloud Vision appelé côté serveur (/gmao/ocr) — Tesseract.js
/// (dans le navigateur) essayé en premier s'est révélé trop lent et
/// imprécis en usage réel.
export function OcrScanButton({ onRecognized }: { onRecognized: (texte: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lignes, setLignes] = useState<string[] | null>(null);

  /// Réduit la photo avant envoi — plus rapide à transférer, et Cloud
  /// Vision n'a pas besoin de la pleine résolution pour lire du texte.
  async function redimensionner(fichier: File, maxDim = 1600): Promise<Blob> {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.round(bitmap.width * echelle);
    const hauteur = Math.round(bitmap.height * echelle);
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? fichier), "image/jpeg", 0.85);
    });
  }

  async function traiter(fichier: File) {
    setEnCours(true);
    setErreur(null);
    try {
      const blob = await redimensionner(fichier);
      const donnees = new FormData();
      donnees.append("image", blob, "photo.jpg");
      const res = await fetch("/gmao/ocr", { method: "POST", body: donnees });
      if (!res.ok) throw new Error();
      const data: { lignes?: string[]; erreur?: string } = await res.json();
      const lignesTrouvees = data.lignes ?? [];
      if (lignesTrouvees.length === 0) {
        setErreur("Aucun texte reconnu sur la photo.");
      } else if (lignesTrouvees.length === 1) {
        onRecognized(lignesTrouvees[0]);
      } else {
        setLignes(lignesTrouvees);
      }
    } catch {
      setErreur("Échec de la lecture.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const fichier = e.target.files?.[0];
          e.target.value = "";
          if (fichier) traiter(fichier);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enCours}
        title="Scanner (OCR)"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      >
        {enCours ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Camera className="h-4 w-4" strokeWidth={2} />
        )}
      </button>

      {erreur && (
        <p className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 shadow-md">
          {erreur}
        </p>
      )}

      {lignes && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 sm:items-center"
          onClick={() => setLignes(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-sm font-bold text-slate-900">
              Texte reconnu — choisir la ligne à utiliser
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {lignes.map((l, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onRecognized(l);
                    setLignes(null);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

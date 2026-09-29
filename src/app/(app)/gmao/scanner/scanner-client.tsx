"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import jsQR from "jsqr";
import { resoudreCodeQr } from "./actions";

/// Scanner QR plein écran — vise l'étiquette collée sur l'équipement,
/// saute directement sur sa fiche GMAO. Remplace le besoin d'un
/// scanner : n'importe quel appareil photo scannant l'étiquette ouvre
/// déjà /q/{code} (page publique, Prompt 7) ; celui-ci est un raccourci
/// pour un technicien déjà connecté dans l'appli.
export function ScannerClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const traiteRef = useRef(false);
  const [erreurCamera, setErreurCamera] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const traiterCode = useCallback(
    async (texte: string) => {
      setEnCours(true);
      setErreur(null);

      let code = texte.trim();
      try {
        const url = new URL(texte);
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length > 0) code = segments[segments.length - 1];
      } catch {
        // Pas une URL — on tente le texte brut tel quel comme code.
      }

      const res = await resoudreCodeQr(code);
      if (!res.ok) {
        setErreur(res.erreur);
        setEnCours(false);
        traiteRef.current = false;
        return;
      }
      router.push(`/gmao/clients/${res.siteId}/equipements/${res.equipementId}`);
    },
    [router],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameId: number;

    function boucle() {
      frameId = requestAnimationFrame(boucle);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA || traiteRef.current) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const resultat = jsQR(image.data, image.width, image.height);
      if (resultat?.data) {
        traiteRef.current = true;
        traiterCode(resultat.data);
      }
    }

    async function demarrer() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        boucle();
      } catch {
        setErreurCamera("Impossible d'accéder à la caméra — vérifie les autorisations dans les réglages du navigateur.");
      }
    }

    demarrer();
    return () => {
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [traiterCode]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Link
        href="/gmao"
        className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      {erreurCamera ? (
        <div className="flex h-full items-center justify-center p-6">
          <p className="max-w-xs text-center text-sm text-white">{erreurCamera}</p>
        </div>
      ) : (
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
      )}
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
        {enCours && (
          <p className="rounded-lg bg-white/90 px-3 py-2 text-center text-sm font-semibold text-slate-700 shadow-sm">
            Recherche de l&apos;équipement...
          </p>
        )}
        {erreur && (
          <p className="rounded-lg bg-red-50/95 px-3 py-2 text-center text-sm font-semibold text-red-700 shadow-sm">
            {erreur}
          </p>
        )}
        {!enCours && !erreur && !erreurCamera && (
          <p className="rounded-lg bg-white/80 px-3 py-2 text-center text-xs text-slate-600 shadow-sm">
            Vise le QR code de l&apos;équipement
          </p>
        )}
      </div>
    </div>
  );
}

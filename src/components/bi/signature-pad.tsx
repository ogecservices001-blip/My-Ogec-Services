"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

export type SignaturePadHandle = {
  /// Data URL PNG, ou chaîne vide si rien n'a été tracé.
  getDataUrl: () => string;
  clear: () => void;
};

/// Pavé de signature tactile — canvas + événements pointer (souris,
/// doigt, stylet), export en PNG base64. Remplace `signature_pad`
/// (Flutter) : pas besoin d'une lib externe pour un simple tracé noir
/// sur fond blanc.
export const SignaturePad = forwardRef<SignaturePadHandle, { titre: string; onChange?: (vide: boolean) => void }>(
  function SignaturePad({ titre, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dessineRef = useRef(false);
    const dernierPointRef = useRef<{ x: number; y: number } | null>(null);
    const [vide, setVide] = useState(true);

    useEffect(() => {
      onChange?.(vide);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- ne notifie que sur un changement réel de `vide`, pas à chaque rendu du parent
    }, [vide]);

    function contexte() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.getContext("2d");
    }

    function pointDepuisEvenement(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const echelleX = canvas.width / rect.width;
      const echelleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * echelleX, y: (e.clientY - rect.top) * echelleY };
    }

    function debuterTrait(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dessineRef.current = true;
      dernierPointRef.current = pointDepuisEvenement(e);
    }

    function tracer(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!dessineRef.current) return;
      const ctx = contexte();
      const dernier = dernierPointRef.current;
      if (!ctx || !dernier) return;
      const point = pointDepuisEvenement(e);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(dernier.x, dernier.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      dernierPointRef.current = point;
      setVide(false);
    }

    function terminerTrait() {
      dessineRef.current = false;
      dernierPointRef.current = null;
    }

    function effacer() {
      const canvas = canvasRef.current;
      const ctx = contexte();
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#fafaf9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setVide(true);
    }

    useImperativeHandle(ref, () => ({
      getDataUrl: () => (vide ? "" : (canvasRef.current?.toDataURL("image/png") ?? "")),
      clear: effacer,
    }));

    return (
      <div>
        <p className="mb-1.5 text-sm font-bold text-slate-700">{titre}</p>
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#fafaf9]">
          <canvas
            ref={canvasRef}
            width={600}
            height={220}
            className="h-[140px] w-full touch-none"
            onPointerDown={debuterTrait}
            onPointerMove={tracer}
            onPointerUp={terminerTrait}
            onPointerLeave={terminerTrait}
          />
        </div>
        <button
          type="button"
          onClick={effacer}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={2} />
          Effacer
        </button>
      </div>
    );
  },
);

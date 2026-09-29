"use client";

import { X } from "lucide-react";
import { urlPubliqueEquipement } from "@/lib/gmao/qr";

/// Dialogue affichant le QR code à imprimer et coller sur l'équipement
/// physique — port de equipement_qr_dialog.dart.
export function QrDialog({
  nom,
  codeQr,
  onClose,
}: {
  nom: string;
  codeQr: string;
  onClose: () => void;
}) {
  const url = urlPubliqueEquipement(codeQr);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">QR code — {nom}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="mx-auto mb-3 inline-block rounded-xl border border-slate-200 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée dynamiquement, pas d'optimisation Next utile */}
          <img src={`/gmao/qr/${codeQr}`} alt={`QR code ${nom}`} width={220} height={220} />
        </div>

        <p className="mb-2 text-xs text-slate-500">
          À imprimer et coller sur l&apos;équipement. Une fois scanné, ce code ouvre une page publique
          permettant de consulter les données de l&apos;équipement et de signaler une panne.
        </p>
        <p className="break-all text-[11px] text-slate-400">{url}</p>
      </div>
    </div>
  );
}

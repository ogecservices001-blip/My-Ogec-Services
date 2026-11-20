"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, X } from "lucide-react";
import { ChoixDestinataires, useDestinataires } from "@/components/choix-destinataires";
import { envoyerDevisParEmail } from "../../actions";

/// Envoi du devis au client : contacts du site à cocher (responsable
/// contrat coché d'office), PDF en pièce jointe.
export function ModaleEnvoiDevis({
  devisId,
  siteId,
  emailParDefaut,
  onClose,
}: {
  devisId: string;
  siteId: string | null;
  emailParDefaut: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [envoi, startEnvoi] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const destinataires = useDestinataires(siteId, [emailParDefaut]);

  function envoyer() {
    setErreur(null);
    startEnvoi(async () => {
      const res = await envoyerDevisParEmail(devisId, destinataires.destinataires());
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Envoyer le devis au client</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">Le PDF du devis sera joint à l&apos;email.</p>
        <ChoixDestinataires etat={destinataires} />
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={envoi}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={envoyer}
            disabled={envoi}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            {envoi ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

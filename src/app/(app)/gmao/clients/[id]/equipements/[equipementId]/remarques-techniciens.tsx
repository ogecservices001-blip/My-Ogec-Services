"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { modifierRemarquesTechniciens } from "../actions";

/// Remarques techniciens de l'équipement (jamais visibles du client),
/// modifiables sur place par le bureau et les techniciens.
export function RemarquesTechniciens({ equipementId, siteId, texte }: { equipementId: string; siteId: string; texte: string }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(texte);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      const r = await modifierRemarquesTechniciens(equipementId, siteId, valeur);
      if (!r.ok) return setErreur(r.erreur);
      setEdition(false);
      router.refresh();
    });
  }

  if (!edition) {
    return (
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-700">
          <span className="font-bold uppercase tracking-wide text-teal-700">Remarques techniciens : </span>
          {texte ? <span className="whitespace-pre-line">{texte}</span> : <span className="text-slate-400">aucune</span>}
        </p>
        <button
          onClick={() => {
            setValeur(texte);
            setEdition(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Pencil className="h-3 w-3" />
          {texte ? "Modifier" : "Ajouter"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-teal-700">Remarques techniciens (jamais visibles du client)</label>
      <textarea
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        rows={4}
        autoFocus
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green"
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={enregistrer} disabled={pending} className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button onClick={() => setEdition(false)} disabled={pending} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          Annuler
        </button>
        {erreur && <span className="text-xs text-red-600">{erreur}</span>}
      </div>
    </div>
  );
}

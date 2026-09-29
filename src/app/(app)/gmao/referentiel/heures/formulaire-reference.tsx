"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { champsReferenceHoraire } from "@/lib/validation/reference-horaire";
import type { ReferenceHoraire } from "@/lib/gmao/types";
import { creerReferenceHoraire, modifierReferenceHoraire } from "./actions";

export function FormulaireReference({
  existante,
  onClose,
}: {
  existante: ReferenceHoraire | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = existante
    ? modifierReferenceHoraire.bind(null, existante.id)
    : creerReferenceHoraire;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {existante ? "Modifier la référence" : "Ajouter une référence"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <form action={formAction} className="space-y-3">
          {state && !state.ok && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>
          )}

          {champsReferenceHoraire.map((champ) => (
            <div key={champ.cle}>
              <label htmlFor={champ.cle} className="mb-1 block text-xs font-medium text-slate-600">
                {champ.label}
              </label>
              <input
                id={champ.cle}
                name={champ.cle}
                inputMode={champ.cle.startsWith("hrs_") ? "decimal" : undefined}
                defaultValue={existante ? String(existante[champ.cle] ?? "") : ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
            >
              {pending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

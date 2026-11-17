"use client";

import { useChampManquant, useSignalerRefusServeur } from "@/components/champ-manquant";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { aujourdhuiISO, TITRES_PU, type ArticlePU } from "@/lib/devis/referentiel-pu";
import { creerArticlePU, modifierArticlePU } from "./actions";

const AIDES: Partial<Record<string, string>> = {
  donnee2: "Unité : Un, ml, Ft...",
  tarif_net_ht: "€ HT",
  mo_heures: "heures",
  date_maj_tarif: "se met à jour quand le tarif change",
};

export function FormulaireArticlePU({ existant, onClose }: { existant: ArticlePU | null; onClose: () => void }) {
  const router = useRouter();
  const action = existant ? modifierArticlePU.bind(null, existant.id) : creerArticlePU;
  const [state, formAction, pending] = useActionState(action, null);
  const { signaler, surChampInvalide, fenetre } = useChampManquant();
  useSignalerRefusServeur(state, signaler);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{existant ? "Modifier l'article" : "Ajouter un article"}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <form action={formAction} onInvalidCapture={surChampInvalide} className="space-y-3">
          {fenetre}
          {state && !state.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            {TITRES_PU.map((t) => {
              const valeur = existant ? existant[t.cle] : "";
              const numerique = t.cle === "tarif_net_ht" || t.cle === "mo_heures";
              const estDate = t.cle === "date_maj_tarif";
              return (
                <div key={t.cle} className={t.cle === "type" ? "sm:col-span-2" : undefined}>
                  <label htmlFor={t.cle} className="mb-1 block text-xs font-medium text-slate-600">
                    {t.titre}
                    {(t.cle === "famille" || t.cle === "type") && <span className="text-red-500"> *</span>}
                    {AIDES[t.cle] && <span className="ml-1 font-normal text-slate-400">({AIDES[t.cle]})</span>}
                  </label>
                  <input
                    id={t.cle}
                    name={t.cle}
                    required={t.cle === "famille" || t.cle === "type"}
                    type={estDate ? "date" : "text"}
                    ref={estDate ? dateRef : undefined}
                    onChange={
                      t.cle === "tarif_net_ht"
                        ? () => {
                            if (dateRef.current) dateRef.current.value = aujourdhuiISO();
                          }
                        : undefined
                    }
                    inputMode={numerique ? "decimal" : undefined}
                    defaultValue={
                      valeur === null || valeur === undefined
                        ? ""
                        : numerique
                          ? String(valeur).replace(".", ",")
                          : estDate
                            ? String(valeur).slice(0, 10)
                            : String(valeur)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                  />
                </div>
              );
            })}
          </div>

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

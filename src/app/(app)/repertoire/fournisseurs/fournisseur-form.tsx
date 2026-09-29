"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { champsFournisseur } from "@/lib/validation/fournisseur";
import { creerFournisseur, modifierFournisseur } from "./actions";
import type { Fournisseur } from "@/lib/types";

export function FournisseurForm({ fournisseur }: { fournisseur?: Fournisseur }) {
  const router = useRouter();
  const action = fournisseur
    ? modifierFournisseur.bind(null, fournisseur.id)
    : creerFournisseur;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(
        fournisseur
          ? `/repertoire/fournisseurs/${fournisseur.id}`
          : "/repertoire/fournisseurs",
      );
      router.refresh();
    }
  }, [state, router, fournisseur]);

  return (
    <form action={formAction}>
      {state && !state.ok && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.erreur}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {champsFournisseur.map((champ) => {
            const erreur = state && !state.ok ? state.champs?.[champ.cle] : undefined;
            return (
              <div key={champ.cle}>
                <label
                  htmlFor={champ.cle}
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  {champ.label}
                </label>
                <input
                  id={champ.cle}
                  name={champ.cle}
                  defaultValue={fournisseur ? String(fournisseur[champ.cle] ?? "") : ""}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                    erreur
                      ? "border-red-300 focus:border-red-400 focus:ring-red-500/20"
                      : "border-slate-200 focus:border-brand-green focus:ring-brand-green/20"
                  }`}
                />
                {erreur && <p className="mt-1 text-xs text-red-600">{erreur}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

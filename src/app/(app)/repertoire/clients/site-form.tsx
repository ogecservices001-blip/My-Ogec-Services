"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { groupesChampsSite } from "@/lib/validation/site";
import { creerSite, modifierSite } from "./actions";
import type { Site } from "@/lib/types";

export function SiteForm({ site }: { site?: Site }) {
  const router = useRouter();
  const action = site ? modifierSite.bind(null, site.id) : creerSite;
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.push(site ? `/repertoire/clients/${site.id}` : "/repertoire/clients");
      router.refresh();
    }
  }, [state, router, site]);

  return (
    <form action={formAction}>
      {state && !state.ok && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.erreur}
        </p>
      )}

      {groupesChampsSite.map((groupe) => (
        <div key={groupe.titre} className="mb-5">
          <h2 className="mb-2 border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-wide text-slate-500 first:border-t-0 first:pt-0">
            {groupe.titre}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {groupe.champs.map((champ) => {
              const erreur =
                state && !state.ok ? state.champs?.[champ.cle] : undefined;
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
                    defaultValue={site ? String(site[champ.cle] ?? "") : ""}
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
      ))}

      <div className="sticky bottom-4 mt-6 flex justify-end gap-3">
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

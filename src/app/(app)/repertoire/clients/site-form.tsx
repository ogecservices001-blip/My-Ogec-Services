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
        <div
          key={groupe.titre}
          className={`mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ${
            groupe.adminOnly ? "border-l-4 border-l-orange-300" : "border-l-4 border-l-brand-green/40"
          }`}
        >
          <div
            className={`px-4 py-2.5 ${groupe.adminOnly ? "bg-orange-50/50" : "bg-green-50/50"}`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {groupe.titre}
            </h2>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
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

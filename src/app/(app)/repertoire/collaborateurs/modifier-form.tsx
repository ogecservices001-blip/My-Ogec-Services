"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QUALITES, QUALITE_VERS_ROLE } from "@/lib/repertoire/qualites";
import { modifierProfil } from "./actions";
import type { Profil } from "@/lib/types";

const CHAMPS_TEXTE: { cle: keyof Profil; label: string }[] = [
  { cle: "name", label: "Nom" },
  { cle: "portable", label: "Portable" },
  { cle: "email_pro", label: "Email pro" },
  { cle: "email_perso", label: "Email personnel" },
  { cle: "commune_habitation", label: "Commune" },
  { cle: "vehicule", label: "Véhicule" },
];

const LABEL_ROLE: Record<string, string> = {
  admin: "Admin (accès complet)",
  technicien: "Technicien (accès terrain)",
  en_attente: "Aucun compte",
};

export function ModifierProfilForm({ profil }: { profil: Profil }) {
  const router = useRouter();
  const action = modifierProfil.bind(null, profil.id);
  const [state, formAction, pending] = useActionState(action, null);
  const [qualite, setQualite] = useState(profil.qualite ?? "");

  useEffect(() => {
    if (state?.ok) {
      router.push("/repertoire/collaborateurs");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      {state && !state.ok && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.erreur}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="qualite" className="mb-1 block text-xs font-medium text-slate-600">
              Qualité
            </label>
            <select
              id="qualite"
              name="qualite"
              value={qualite}
              onChange={(e) => setQualite(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">—</option>
              {QUALITES.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Accès attribué : {LABEL_ROLE[QUALITE_VERS_ROLE[qualite] ?? ""] ?? "inchangé"}
            </p>
          </div>

          {CHAMPS_TEXTE.map((champ) => {
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
                  defaultValue={String(profil[champ.cle] ?? "")}
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

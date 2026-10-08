"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { champsFournisseur, type FournisseurInput, type Interlocuteur } from "@/lib/validation/fournisseur";
import { creerFournisseur, modifierFournisseur } from "./actions";
import type { Fournisseur } from "@/lib/types";

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

const INTERLOCUTEUR_VIDE: Interlocuteur = { nom: "", tel: "", portable: "", email: "" };

export function FournisseurForm({ fournisseur }: { fournisseur?: Fournisseur }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [champs, setChamps] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of champsFournisseur) {
      if (c.cle === "interlocuteurs") continue;
      init[c.cle] = fournisseur ? String(fournisseur[c.cle as keyof Fournisseur] ?? "") : "";
    }
    return init;
  });

  const [interlocuteurs, setInterlocuteurs] = useState<Interlocuteur[]>(
    () => (fournisseur?.interlocuteurs as unknown as Interlocuteur[] | null) ?? [],
  );

  function majInterlocuteur(i: number, champ: keyof Interlocuteur, valeur: string) {
    setInterlocuteurs((prev) => prev.map((it, idx) => (idx === i ? { ...it, [champ]: valeur } : it)));
  }

  function soumettre() {
    if (!champs.nom?.trim()) {
      setErreur("Le nom du fournisseur est obligatoire.");
      return;
    }
    setErreur(null);

    const input: FournisseurInput = {
      ...(champs as Omit<FournisseurInput, "interlocuteurs">),
      interlocuteurs: interlocuteurs.filter((i) => i.nom || i.tel || i.portable || i.email),
    };

    startTransition(async () => {
      const res = fournisseur ? await modifierFournisseur(fournisseur.id, input) : await creerFournisseur(input);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push(fournisseur ? `/repertoire/fournisseurs/${fournisseur.id}` : "/repertoire/fournisseurs");
      router.refresh();
    });
  }

  return (
    <div>
      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {champsFournisseur.map((champ) => (
            <div key={champ.cle}>
              <label htmlFor={champ.cle} className={ETIQUETTE}>
                {champ.label}
              </label>
              <input
                id={champ.cle}
                value={champs[champ.cle] ?? ""}
                onChange={(e) => setChamps((prev) => ({ ...prev, [champ.cle]: e.target.value }))}
                className={CHAMP}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Interlocuteurs</h2>
          <button
            type="button"
            onClick={() => setInterlocuteurs((prev) => [...prev, { ...INTERLOCUTEUR_VIDE }])}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Ajouter
          </button>
        </div>

        {interlocuteurs.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun interlocuteur.</p>
        ) : (
          <div className="space-y-3">
            {interlocuteurs.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Interlocuteur {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInterlocuteurs((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-500 transition hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={ETIQUETTE}>Nom</label>
                    <input
                      value={it.nom}
                      onChange={(e) => majInterlocuteur(i, "nom", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Email</label>
                    <input
                      value={it.email}
                      onChange={(e) => majInterlocuteur(i, "email", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Tél fixe</label>
                    <input
                      value={it.tel}
                      onChange={(e) => majInterlocuteur(i, "tel", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Portable</label>
                    <input
                      value={it.portable}
                      onChange={(e) => majInterlocuteur(i, "portable", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={soumettre}
          disabled={pending}
          className="rounded-xl bg-brand-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

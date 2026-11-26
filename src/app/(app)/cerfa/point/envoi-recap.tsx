"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useChampManquant } from "@/components/champ-manquant";
import { envoyerRecapPoint } from "../actions";

export function EnvoiRecap({ objet, corps }: { objet: string; corps: string }) {
  const { signaler, fenetre } = useChampManquant();
  const [ouvert, setOuvert] = useState(false);
  const [email, setEmail] = useState("ogec.services@orange.fr");
  const [enCours, setEnCours] = useState(false);

  async function envoyer() {
    if (!email.trim()) return signaler("Renseigne l'adresse destinataire", "recap-email");
    setEnCours(true);
    const r = await envoyerRecapPoint(email, objet, corps);
    setEnCours(false);
    if (!r.ok) return signaler("Récapitulatif non envoyé", "recap-email", { detail: r.erreur });
    setOuvert(false);
    signaler("Récapitulatif envoyé.");
  }

  return (
    <>
      {fenetre}
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
      >
        <Mail className="h-4 w-4" /> Envoyer le récapitulatif
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-base font-bold text-slate-900">Envoyer le récapitulatif</h2>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="recap-email">
              Adresse destinataire
            </label>
            <input
              id="recap-email"
              type="email"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Annuler
              </button>
              <button type="button" disabled={enCours} onClick={envoyer} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {enCours ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

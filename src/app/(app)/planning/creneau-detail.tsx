"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Trash2, Users, X } from "lucide-react";
import { supprimerCreneau } from "./actions";
import type { CreneauAffiche } from "./creneau-carte";

/// Détail d'un créneau, ouvert au clic sur sa carte — regroupe les
/// actions Modifier/Supprimer ici plutôt que sur la carte elle-même
/// (trop de boutons serrés dans la grille sinon).
export function CreneauDetail({
  creneau,
  onModifier,
  onFerme,
}: {
  creneau: CreneauAffiche;
  onModifier: () => void;
  onFerme: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const titre = `${creneau.client_nom} — ${creneau.site}`;

  function supprimer() {
    setErreur(null);
    startTransition(async () => {
      const res = await supprimerCreneau(creneau.id);
      if (!res.ok) {
        setErreur(res.erreur || "Échec de la suppression (erreur inconnue).");
        return;
      }
      router.refresh();
      onFerme();
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{titre}</h2>
          <button onClick={onFerme} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="mb-4 space-y-1.5 text-sm text-slate-600">
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            {creneau.date.split("-").reverse().join("/")}
            {creneau.heure_debut ? ` — ${creneau.heure_debut}` : ""} — {creneau.heures_prevues}h
          </p>
          {creneau.techniciens && creneau.techniciens.length > 0 && (
            <p className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" strokeWidth={2} />
              {creneau.techniciens.map((t) => t.name).join(", ")}
            </p>
          )}
          {creneau.observations && <p className="text-slate-400">{creneau.observations}</p>}
        </div>

        {erreur && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

        {confirmation ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-sm font-semibold text-red-700">Supprimer ce créneau ?</p>
            <div className="flex gap-2">
              <button
                onClick={supprimer}
                disabled={pending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Suppression..." : "Confirmer"}
              </button>
              <button
                onClick={() => setConfirmation(false)}
                disabled={pending}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onModifier}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-green-dark"
            >
              <Pencil className="h-4 w-4" strokeWidth={2.25} />
              Modifier
            </button>
            <button
              onClick={() => setConfirmation(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

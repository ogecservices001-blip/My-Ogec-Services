"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Trash2, Users } from "lucide-react";
import { supprimerCreneau } from "./actions";

export type CreneauAffiche = {
  id: string;
  poste_hors_client_id: string | null;
  client_nom: string;
  site: string;
  date: string;
  heure_debut: string | null;
  heures_prevues: number;
  observations: string;
  techniciens?: { id: string; name: string }[];
};

export function CreneauCarte({
  creneau,
  isAdmin,
  onModifier,
}: {
  creneau: CreneauAffiche;
  isAdmin: boolean;
  onModifier?: (creneau: CreneauAffiche) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const estHorsClient = !!creneau.poste_hors_client_id;
  const titre = `${creneau.client_nom} — ${creneau.site}`;

  function supprimer() {
    setErreur(null);
    startTransition(async () => {
      const res = await supprimerCreneau(creneau.id);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={`rounded-xl border p-3 ${estHorsClient ? "border-amber-300 bg-amber-50/60" : "border-teal-200 bg-teal-50/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{titre}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3" strokeWidth={2} />
            {creneau.heure_debut ? `${creneau.heure_debut} — ` : ""}
            {creneau.heures_prevues}h
          </p>
          {creneau.techniciens && creneau.techniciens.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Users className="h-3 w-3" strokeWidth={2} />
              {creneau.techniciens.map((t) => t.name).join(", ")}
            </p>
          )}
          {creneau.observations && <p className="mt-1 text-xs text-slate-400">{creneau.observations}</p>}
        </div>
      </div>

      {erreur && <p className="mt-2 text-[11px] font-medium text-red-600">{erreur}</p>}

      {isAdmin && (
        <div className="mt-2">
          {confirmation ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-red-700">Supprimer ce créneau ?</span>
              <button
                onClick={supprimer}
                disabled={pending}
                className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "..." : "Confirmer"}
              </button>
              <button
                onClick={() => setConfirmation(false)}
                disabled={pending}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onModifier && (
                <button
                  onClick={() => onModifier(creneau)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.25} />
                  Modifier
                </button>
              )}
              <button
                onClick={() => setConfirmation(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-red-600 shadow-sm hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

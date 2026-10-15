"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, Pencil, Trash2, Users } from "lucide-react";
import { lienGoogleCalendar } from "@/lib/planning/google-calendar";
import { supprimerCreneau } from "./actions";

export type CreneauAffiche = {
  id: string;
  type_creneau: string;
  client_nom: string;
  site: string;
  motif_absence: string;
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

  const estAbsence = creneau.type_creneau === "absence";
  const titre = estAbsence ? `Absence — ${creneau.motif_absence || "Non précisé"}` : `${creneau.client_nom} — ${creneau.site}`;

  function supprimer() {
    if (!confirm("Supprimer ce créneau ?")) return;
    startTransition(async () => {
      await supprimerCreneau(creneau.id);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-xl border p-3 ${estAbsence ? "border-amber-300 bg-amber-50/40" : "border-slate-200/80 bg-slate-50/50"}`}>
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

      <div className="mt-2 flex items-center gap-2">
        <a
          href={lienGoogleCalendar({
            date: creneau.date,
            heureDebut: creneau.heure_debut,
            heuresPrevues: creneau.heures_prevues,
            titre,
            lieu: estAbsence ? "" : creneau.site,
            observations: creneau.observations,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <CalendarPlus className="h-3 w-3" strokeWidth={2.25} />
          Ajouter à mon calendrier
        </a>

        {isAdmin && (
          <>
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
              onClick={supprimer}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" strokeWidth={2.25} />
              Supprimer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

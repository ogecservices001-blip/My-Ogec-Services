"use client";

import { Clock, Users } from "lucide-react";

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

/// Carte compacte, purement informative — les actions (Modifier,
/// Supprimer) sont dans le détail ouvert au clic (voir
/// creneau-detail.tsx), pas sur la carte elle-même : trop de boutons
/// serrés dans la grille rendaient l'ensemble illisible.
export function CreneauCarte({
  creneau,
  cliquable,
  onClick,
}: {
  creneau: CreneauAffiche;
  cliquable?: boolean;
  onClick?: () => void;
}) {
  const estHorsClient = !!creneau.poste_hors_client_id;
  const titre = `${creneau.client_nom} — ${creneau.site}`;

  const Composant = cliquable ? "button" : "div";

  return (
    <Composant
      onClick={cliquable ? onClick : undefined}
      type={cliquable ? "button" : undefined}
      className={`w-full rounded-xl border p-3 text-left ${cliquable ? "cursor-pointer hover:shadow-sm" : ""} ${
        estHorsClient ? "border-amber-300 bg-amber-50/60" : "border-teal-200 bg-teal-50/50"
      }`}
    >
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
    </Composant>
  );
}

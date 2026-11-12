"use client";

import { ClipboardCheck, Clock, Users } from "lucide-react";
import { LIBELLE_VALIDATION, type EtatValidation } from "@/lib/planning/validation";

export type CreneauAffiche = {
  id: string;
  poste_hors_client_id: string | null;
  client_nom: string;
  site: string;
  date: string;
  heure_debut: string | null;
  heures_prevues: number;
  observations: string;
  visite_numero?: number | null;
  visite_total?: number | null;
  techniciens?: { id: string; name: string }[];
  bi?: { id: string; numero: string; statut: string } | null;
  validation?: EtatValidation | null;
};

const STYLE_VALIDATION: Record<string, string> = {
  attente: "bg-orange-100 text-orange-700",
  valide: "bg-green-100 text-green-700",
  autre_date: "bg-purple-100 text-purple-700",
  a_reproposer: "bg-red-100 text-red-700",
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
      {creneau.visite_numero && creneau.visite_total && (
        <p className="text-[11px] font-semibold text-teal-700">
          Visite {creneau.visite_numero}/{creneau.visite_total}
        </p>
      )}
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
      {creneau.validation && (
        <p className={`mt-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${STYLE_VALIDATION[creneau.validation.statut]}`}>
          {LIBELLE_VALIDATION[creneau.validation.statut]}
          {creneau.validation.statut === "autre_date" && creneau.validation.datePropose &&
            ` : ${creneau.validation.datePropose.split("-").reverse().slice(0, 2).join("/")}`}
        </p>
      )}
      {creneau.observations && <p className="mt-1 text-xs text-slate-400">{creneau.observations}</p>}
      {creneau.bi && (
        <p
          className={`mt-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold ${
            creneau.bi.statut === "brouillon" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          <ClipboardCheck className="h-3 w-3 shrink-0" strokeWidth={2.25} />
          {creneau.bi.statut === "brouillon" ? "BI en cours (brouillon)" : `BI fait — ${creneau.bi.numero}`}
        </p>
      )}
    </Composant>
  );
}

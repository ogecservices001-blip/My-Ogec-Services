"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CreneauCarte, type CreneauAffiche } from "./creneau-carte";
import { NouveauCreneauForm } from "./nouveau-creneau-form";
import { ajouterJours, formaterJourCourt } from "@/lib/planning/dates";

type SiteOption = { id: string; nom: string; site: string };
type TechnicienOption = { id: string; name: string };
type CreneauComplet = CreneauAffiche & { site_id: string | null; devis_id: string | null };

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

/// Une couleur par technicien (en-tête de colonne + liseré de la
/// colonne), pour repérer son planning d'un coup d'œil dans la grille —
/// même palette tournante qu'ailleurs dans l'app (ex. équipements GMAO).
const COULEURS = [
  { bg: "bg-teal-100", text: "text-teal-700", bordure: "border-t-teal-400" },
  { bg: "bg-indigo-100", text: "text-indigo-700", bordure: "border-t-indigo-400" },
  { bg: "bg-orange-100", text: "text-orange-700", bordure: "border-t-orange-400" },
  { bg: "bg-purple-100", text: "text-purple-700", bordure: "border-t-purple-400" },
  { bg: "bg-pink-100", text: "text-pink-700", bordure: "border-t-pink-400" },
  { bg: "bg-cyan-100", text: "text-cyan-700", bordure: "border-t-cyan-400" },
  { bg: "bg-rose-100", text: "text-rose-700", bordure: "border-t-rose-400" },
  { bg: "bg-emerald-100", text: "text-emerald-700", bordure: "border-t-emerald-400" },
  { bg: "bg-amber-100", text: "text-amber-700", bordure: "border-t-amber-400" },
  { bg: "bg-sky-100", text: "text-sky-700", bordure: "border-t-sky-400" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", bordure: "border-t-fuchsia-400" },
];

export function GrilleSemaine({
  lundiSemaine,
  sites,
  techniciens,
  joursFeries,
  creneaux,
}: {
  lundiSemaine: string;
  sites: SiteOption[];
  techniciens: TechnicienOption[];
  joursFeries: string[];
  creneaux: CreneauComplet[];
}) {
  const [formulaire, setFormulaire] = useState<{ date: string; technicienId?: string; creneau?: CreneauComplet } | null>(null);

  const joursSemaine = JOURS.map((nom, i) => ({ nom, date: ajouterJours(lundiSemaine, i) }));
  const semainePrecedente = ajouterJours(lundiSemaine, -7);
  const semaineSuivante = ajouterJours(lundiSemaine, 7);

  function creneauxDuJourEtTechnicien(date: string, technicienId: string): CreneauComplet[] {
    return creneaux.filter((c) => c.date === date && c.techniciens?.some((t) => t.id === technicienId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/planning?semaine=${semainePrecedente}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          Semaine précédente
        </Link>
        <p className="text-sm font-semibold text-slate-700">
          {formaterJourCourt(joursSemaine[0].date)} — {formaterJourCourt(joursSemaine[4].date)}
        </p>
        <Link
          href={`/planning?semaine=${semaineSuivante}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          Semaine suivante
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[780px] gap-1.5" style={{ gridTemplateColumns: `100px repeat(${techniciens.length}, minmax(70px, 1fr))` }}>
          <div />
          {techniciens.map((t, i) => {
            const couleur = COULEURS[i % COULEURS.length];
            const [nom, ...reste] = t.name.split(" ");
            const prenom = reste.join(" ");
            return (
              <div key={t.id} className={`rounded-lg px-1 py-2 text-center text-xs font-bold leading-tight ${couleur.bg} ${couleur.text}`}>
                <span className="block">{nom}</span>
                {prenom && <span className="block font-normal">{prenom}</span>}
              </div>
            );
          })}

          {joursSemaine.map((jour) => {
            const ferie = joursFeries.includes(jour.date);
            return (
              <div key={jour.date} className="contents">
                <div className={`flex flex-col justify-center rounded-lg px-2 py-2 text-xs font-bold ${ferie ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
                  {jour.nom}
                  <span className="font-normal text-slate-400">{formaterJourCourt(jour.date)}</span>
                  {ferie && <span className="text-[10px]">Férié</span>}
                </div>
                {techniciens.map((t, i) => {
                  const couleur = COULEURS[i % COULEURS.length];
                  const creneauxCellule = creneauxDuJourEtTechnicien(jour.date, t.id);
                  return (
                    <div
                      key={t.id}
                      className={`min-h-[70px] space-y-1.5 rounded-lg border border-t-2 border-dashed border-slate-200 bg-white/60 p-1.5 ${couleur.bordure}`}
                    >
                      {creneauxCellule.map((c) => (
                        <CreneauCarte key={c.id} creneau={c} isAdmin onModifier={(cr) => setFormulaire({ date: jour.date, creneau: cr as CreneauComplet })} />
                      ))}
                      {!ferie && (
                        <button
                          onClick={() => setFormulaire({ date: jour.date, technicienId: t.id })}
                          className="flex w-full items-center justify-center rounded-lg py-1 text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {formulaire && (
        <NouveauCreneauForm
          sites={sites}
          techniciens={techniciens}
          joursFeries={joursFeries}
          dateInitiale={formulaire.date}
          technicienInitialId={formulaire.technicienId}
          creneauAModifier={formulaire.creneau}
          techniciensDuCreneau={formulaire.creneau?.techniciens?.map((t) => t.id)}
          onFerme={() => setFormulaire(null)}
        />
      )}
    </div>
  );
}

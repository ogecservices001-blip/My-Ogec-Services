"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CreneauCarte, type CreneauAffiche } from "./creneau-carte";
import { NouveauCreneauForm } from "./nouveau-creneau-form";

type SiteOption = { id: string; nom: string; site: string };
type TechnicienOption = { id: string; name: string };
type CreneauComplet = CreneauAffiche & { site_id: string | null; devis_id: string | null };

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

function ajouterJours(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formaterJour(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

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
          {formaterJour(joursSemaine[0].date)} — {formaterJour(joursSemaine[4].date)}
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
        <div className="grid min-w-[900px] gap-2" style={{ gridTemplateColumns: `140px repeat(${techniciens.length}, 1fr)` }}>
          <div />
          {techniciens.map((t) => (
            <div key={t.id} className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-bold text-slate-700">
              {t.name}
            </div>
          ))}

          {joursSemaine.map((jour) => {
            const ferie = joursFeries.includes(jour.date);
            return (
              <div key={jour.date} className="contents">
                <div className={`flex flex-col justify-center rounded-lg px-2 py-2 text-xs font-bold ${ferie ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
                  {jour.nom}
                  <span className="font-normal text-slate-400">{formaterJour(jour.date)}</span>
                  {ferie && <span className="text-[10px]">Férié</span>}
                </div>
                {techniciens.map((t) => {
                  const creneauxCellule = creneauxDuJourEtTechnicien(jour.date, t.id);
                  return (
                    <div key={t.id} className="min-h-[70px] space-y-1.5 rounded-lg border border-dashed border-slate-200 p-1.5">
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

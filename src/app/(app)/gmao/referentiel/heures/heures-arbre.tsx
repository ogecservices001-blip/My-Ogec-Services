"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Upload, Download, Plus, Pencil, Clock, FolderTree } from "lucide-react";
import type { ReferenceHoraire } from "@/lib/gmao/types";
import { construireArbreReferences, compterFeuilles, type NoeudReference } from "@/lib/gmao/reference-horaire-tree";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { supprimerReferenceHoraire } from "./actions";
import { FormulaireReference } from "./formulaire-reference";
import { ModaleImport } from "./modale-import";

const COULEURS = [
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
];

export function HeuresArbre({
  references,
  isAdmin,
}: {
  references: ReferenceHoraire[];
  isAdmin: boolean;
}) {
  const arbre = useMemo(() => construireArbreReferences(references), [references]);
  const [modaleFormulaire, setModaleFormulaire] = useState<{ existante: ReferenceHoraire | null } | null>(
    null,
  );
  const [modaleImport, setModaleImport] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/gmao/referentiel"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href="/gmao/referentiel/heures/export"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter en Excel"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <button
              onClick={() => setModaleImport(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer un classeur"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              onClick={() => setModaleFormulaire({ existante: null })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Ajouter
            </button>
          </div>
        )}
      </div>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Heures de référence équipements
      </h1>
      <p className="mb-5 text-sm text-slate-500">{references.length} référence(s)</p>

      {arbre.racines.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Référentiel vide — importe le classeur ou ajoute une ligne
        </p>
      ) : (
        <div className="space-y-3">
          {arbre.racines.map((noeud, i) => (
            <Noeud
              key={noeud.label}
              noeud={noeud}
              couleur={COULEURS[i % COULEURS.length]}
              racine
              ouvertParDefaut={arbre.racines.length === 1}
              isAdmin={isAdmin}
              onModifier={(r) => setModaleFormulaire({ existante: r })}
            />
          ))}
        </div>
      )}

      {modaleFormulaire && (
        <FormulaireReference
          key={modaleFormulaire.existante?.id ?? "nouveau"}
          existante={modaleFormulaire.existante}
          onClose={() => setModaleFormulaire(null)}
        />
      )}

      {modaleImport && <ModaleImport onClose={() => setModaleImport(false)} />}
    </div>
  );
}

function Noeud({
  noeud,
  couleur,
  racine,
  ouvertParDefaut,
  isAdmin,
  onModifier,
}: {
  noeud: NoeudReference;
  couleur: { bg: string; text: string };
  racine: boolean;
  ouvertParDefaut: boolean;
  isAdmin: boolean;
  onModifier: (r: ReferenceHoraire) => void;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const nbReferences = compterFeuilles(noeud);

  const contenu = (
    <>
      {noeud.feuilles.map((ref) => (
        <CarteReference key={ref.id} reference={ref} isAdmin={isAdmin} onModifier={onModifier} />
      ))}
      {noeud.enfants.map((enfant) => (
        <Noeud
          key={enfant.label}
          noeud={enfant}
          couleur={couleur}
          racine={false}
          ouvertParDefaut={false}
          isAdmin={isAdmin}
          onModifier={onModifier}
        />
      ))}
    </>
  );

  if (racine) {
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <button
          onClick={() => setOuvert((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${couleur.bg}`}>
            <FolderTree className={`h-5 w-5 ${couleur.text}`} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-slate-900">{noeud.label}</span>
            <span className="block text-xs text-slate-500">{nbReferences} référence(s)</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition ${ouvert ? "rotate-180" : ""}`}
          />
        </button>
        {ouvert && <div className="space-y-2 px-4 pb-4">{contenu}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 pl-2">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left"
      >
        <span className={`text-sm font-semibold ${couleur.text}`}>{noeud.label}</span>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {nbReferences} référence(s)
          <ChevronDown className={`h-3.5 w-3.5 transition ${ouvert ? "rotate-180" : ""}`} />
        </span>
      </button>
      {ouvert && <div className="space-y-2 pb-2 pl-2">{contenu}</div>}
    </div>
  );
}

function CarteReference({
  reference,
  isAdmin,
  onModifier,
}: {
  reference: ReferenceHoraire;
  isAdmin: boolean;
  onModifier: (r: ReferenceHoraire) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{reference.designation}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Tech : {reference.hrs_tech_an}h / {reference.hrs_tech_sem}h / {reference.hrs_tech_tri}h /{" "}
              {reference.hrs_tech_men}h
              {"  ·  "}
              Assistant : {reference.hrs_assistant_an}h / {reference.hrs_assistant_sem}h /{" "}
              {reference.hrs_assistant_tri}h / {reference.hrs_assistant_men}h
            </p>
            <p className="text-[11px] text-slate-400">(Annuelle / Semestrielle / Trimestrielle / Mensuelle)</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => onModifier(reference)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Modifier"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      {isAdmin && (
        <div className="mt-2">
          <BoutonSupprimer
            action={supprimerReferenceHoraire.bind(null, reference.id)}
            confirmation={`Supprimer la référence "${reference.designation}" ?`}
            redirectTo="/gmao/referentiel/heures"
          />
        </div>
      )}
    </div>
  );
}

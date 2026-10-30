"use client";

import { useMemo, useState } from "react";
import { Search, Upload, Download, Plus, Pencil } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { ReferenceHoraire } from "@/lib/gmao/types";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { supprimerReferenceHoraire } from "./actions";
import { FormulaireReference } from "./formulaire-reference";
import { ModaleImport } from "./modale-import";

const COLONNES: ColonneTableur[] = [
  { titre: "Type 1" },
  { titre: "Type 2" },
  { titre: "Type 3" },
  { titre: "Désignation" },
  { titre: "Tech An", droite: true, largeur: "70px" },
  { titre: "Assist. An", droite: true, largeur: "70px" },
  { titre: "Tech Sem", droite: true, largeur: "70px" },
  { titre: "Assist. Sem", droite: true, largeur: "70px" },
  { titre: "Tech Tri", droite: true, largeur: "70px" },
  { titre: "Assist. Tri", droite: true, largeur: "70px" },
  { titre: "Tech Men", droite: true, largeur: "70px" },
  { titre: "Assist. Men", droite: true, largeur: "70px" },
];
const COLONNES_ADMIN: ColonneTableur[] = [...COLONNES, { titre: "" }];

export function HeuresListe({
  references,
  isAdmin,
}: {
  references: ReferenceHoraire[];
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [modaleFormulaire, setModaleFormulaire] = useState<{ existante: ReferenceHoraire | null } | null>(null);
  const [modaleImport, setModaleImport] = useState(false);

  const filtres = useMemo(() => {
    const q = recherche.toLowerCase();
    return references.filter(
      (r) =>
        r.designation.toLowerCase().includes(q) ||
        r.type_equipement1.toLowerCase().includes(q) ||
        r.type_equipement2.toLowerCase().includes(q) ||
        r.type_equipement3.toLowerCase().includes(q),
    );
  }, [references, recherche]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            Heures de référence équipements
          </h1>
          <p className="text-sm text-slate-500">{filtres.length} référence(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Rechercher une référence..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-56 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          {isAdmin && (
            <>
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
            </>
          )}
        </div>
      </div>

      <Tableur
        colonnes={isAdmin ? COLONNES_ADMIN : COLONNES}
        lignes={filtres.map((r) => {
          const base = [
            r.type_equipement1,
            r.type_equipement2,
            r.type_equipement3,
            isAdmin ? (
              <button
                key="designation"
                type="button"
                onClick={() => setModaleFormulaire({ existante: r })}
                className="font-bold text-slate-900 hover:underline"
              >
                {r.designation}
              </button>
            ) : (
              r.designation
            ),
            r.hrs_tech_an,
            r.hrs_assistant_an,
            r.hrs_tech_sem,
            r.hrs_assistant_sem,
            r.hrs_tech_tri,
            r.hrs_assistant_tri,
            r.hrs_tech_men,
            r.hrs_assistant_men,
          ];
          if (!isAdmin) return base;
          return [
            ...base,
            <div key="actions" className="flex items-center gap-1">
              <button
                onClick={() => setModaleFormulaire({ existante: r })}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <BoutonSupprimer
                action={supprimerReferenceHoraire.bind(null, r.id)}
                confirmation={`Supprimer la référence "${r.designation}" ?`}
                redirectTo="/gmao/referentiel/heures"
              />
            </div>,
          ];
        })}
        valeurs={filtres.map((r) => [r.type_equipement1, r.type_equipement2, r.type_equipement3, r.designation])}
        vide="Référentiel vide — importe le classeur ou ajoute une ligne"
      />

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

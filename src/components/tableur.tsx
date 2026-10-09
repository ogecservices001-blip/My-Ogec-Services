"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Filter } from "lucide-react";

export type ColonneTableur = { titre: string; largeur?: string; droite?: boolean };

/// Valeur "plate" d'une cellule, uniquement pour le filtre d'en-tête
/// (jamais affichée) — nécessaire dès que la cellule réellement rendue
/// est un lien/badge (JSX) plutôt qu'un texte simple, auquel cas elle
/// ne peut pas servir elle-même de valeur de filtre.
export type ValeurCellule = string | number | null | undefined;

const SANS_FILTRE = "__sans_filtre__";

/// Tableau façon classeur Excel (en-têtes fixes, lignes alternées), même
/// rendu que le registre Devis et Audit Heures. Chaque colonne dont la
/// valeur est connue (texte/nombre simple en cellule, ou fournie via
/// `valeurs`) a un filtre d'en-tête à cocher, comme le filtre Excel —
/// composant interactif (nécessite "use client"), mais reste utilisable
/// depuis un Server Component qui le rend comme enfant.
///
/// Responsive : au-delà de `md` (les PC du bureau), le tableau classeur
/// s'affiche. En dessous (tablette/téléphone des techniciens), il cède
/// la place à une carte par ligne — même règle pour tout écran qui
/// utilise ce composant, présent ou futur, sans rien à faire de plus.
export function Tableur({
  colonnes,
  lignes,
  valeurs,
  pied,
  vide = "Aucune ligne",
  largeurMin = 700,
}: {
  colonnes: ColonneTableur[];
  lignes: ReactNode[][];
  /// Valeurs de filtrage, même forme que `lignes` — à fournir pour les
  /// colonnes dont la cellule affichée n'est pas déjà un texte/nombre
  /// simple (lien, badge...). Facultatif par colonne : `null`/absent
  /// laisse Tableur déduire la valeur depuis `lignes` si c'est un texte
  /// ou un nombre, sinon la colonne n'a simplement pas de filtre.
  valeurs?: ValeurCellule[][];
  pied?: ReactNode[];
  vide?: string;
  largeurMin?: number;
}) {
  const [filtres, setFiltres] = useState<Record<number, Set<string>>>({});
  const [colonneOuverte, setColonneOuverte] = useState<number | null>(null);

  function valeurDe(r: number, c: number): string | null {
    const v = valeurs?.[r]?.[c];
    if (v !== undefined && v !== null) return String(v);
    const cellule = lignes[r]?.[c];
    if (typeof cellule === "string" || typeof cellule === "number") return String(cellule);
    return null;
  }

  const optionsParColonne = useMemo(() => {
    return colonnes.map((_, c) => {
      const vues = new Set<string>();
      let filtrable = false;
      for (let r = 0; r < lignes.length; r++) {
        const v = valeurDe(r, c);
        if (v !== null) {
          filtrable = true;
          vues.add(v === "" ? SANS_FILTRE : v);
        }
      }
      if (!filtrable) return null;
      return [...vues].sort((a, b) => a.localeCompare(b, "fr"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colonnes, lignes, valeurs]);

  const lignesFiltrees = useMemo(() => {
    return lignes
      .map((cellules, r) => ({ cellules, r }))
      .filter(({ r }) =>
        Object.entries(filtres).every(([c, actives]) => {
          const v = valeurDe(r, Number(c));
          return actives.has(v === "" || v === null ? SANS_FILTRE : v);
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, valeurs, filtres]);

  function basculerValeur(c: number, valeur: string) {
    setFiltres((prev) => {
      const options = optionsParColonne[c] ?? [];
      const actuel = prev[c] ?? new Set(options);
      const next = new Set(actuel);
      if (next.has(valeur)) next.delete(valeur);
      else next.add(valeur);
      const copie = { ...prev };
      if (next.size === options.length) delete copie[c];
      else copie[c] = next;
      return copie;
    });
  }

  function toutCocher(c: number) {
    setFiltres((prev) => {
      const copie = { ...prev };
      delete copie[c];
      return copie;
    });
  }

  function toutDecocher(c: number) {
    setFiltres((prev) => ({ ...prev, [c]: new Set() }));
  }

  if (lignes.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{vide}</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: largeurMin }}>
          <thead>
            <tr>
              {colonnes.map((col, c) => {
                const options = optionsParColonne[c];
                const actif = Boolean(filtres[c]);
                return (
                  <th
                    key={c}
                    style={col.largeur ? { width: col.largeur } : undefined}
                    className={`relative border-b border-slate-200 px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 ${
                      col.droite ? "text-right" : "text-left"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.titre}
                      {options && (
                        <button
                          type="button"
                          onClick={() => setColonneOuverte(colonneOuverte === c ? null : c)}
                          className={`rounded p-0.5 normal-case transition ${actif ? "text-brand-green" : "text-slate-300 hover:text-slate-500"}`}
                          title="Filtrer"
                        >
                          <Filter className="h-3 w-3" strokeWidth={2.5} fill={actif ? "currentColor" : "none"} />
                        </button>
                      )}
                    </span>
                    {colonneOuverte === c && options && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setColonneOuverte(null)} />
                        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 normal-case shadow-lg">
                          <div className="mb-1 flex gap-2 border-b border-slate-100 pb-1.5 text-[11px] font-semibold text-brand-green">
                            <button type="button" onClick={() => toutCocher(c)} className="hover:underline">
                              Tout
                            </button>
                            <button type="button" onClick={() => toutDecocher(c)} className="hover:underline">
                              Aucun
                            </button>
                          </div>
                          {options.map((valeur) => {
                            const coche = !filtres[c] || filtres[c].has(valeur);
                            return (
                              <label key={valeur} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs font-normal text-slate-700 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={coche}
                                  onChange={() => basculerValeur(c, valeur)}
                                  className="h-3.5 w-3.5 accent-brand-green"
                                />
                                <span className="truncate">{valeur === SANS_FILTRE ? "(vide)" : valeur}</span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lignesFiltrees.map(({ cellules }, r) => (
              <tr key={r} className={r % 2 === 1 ? "bg-slate-50/50" : ""}>
                {cellules.map((cellule, c) => (
                  <td
                    key={c}
                    className={`truncate border-b border-slate-100 px-2 py-2 text-slate-700 ${
                      colonnes[c]?.droite ? "text-right" : ""
                    }`}
                  >
                    {cellule}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {pied && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-900">
                {pied.map((cellule, c) => (
                  <td key={c} className={`px-2 py-2 ${colonnes[c]?.droite ? "text-right" : ""}`}>
                    {cellule}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="space-y-2.5 md:hidden">
        {lignesFiltrees.map(({ cellules }, r) => (
          <CarteLigne key={r} colonnes={colonnes} cellules={cellules} />
        ))}
        {pied && <CartePied colonnes={colonnes} pied={pied} />}
      </div>
    </>
  );
}

/// Carte générique : la 1ère colonne sert de titre, les colonnes sans
/// titre (actions/icônes, ex. bouton Modifier) passent en haut à
/// droite, le reste s'affiche en "étiquette : valeur", les cellules
/// vides étant omises.
function CarteLigne({ colonnes, cellules }: { colonnes: ColonneTableur[]; cellules: ReactNode[] }) {
  const estVide = (v: ReactNode) => v === "" || v === null || v === undefined;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 truncate font-semibold text-slate-900">{cellules[0]}</div>
        <div className="flex shrink-0 items-center gap-1">
          {colonnes.map((c, i) => (i > 0 && c.titre === "" ? <span key={i}>{cellules[i]}</span> : null))}
        </div>
      </div>
      <dl className="mt-1.5 space-y-1">
        {colonnes.map((c, i) => {
          if (i === 0 || c.titre === "" || estVide(cellules[i])) return null;
          return (
            <div key={i} className="flex items-baseline gap-1.5 text-xs">
              <dt className="shrink-0 text-slate-400">{c.titre} :</dt>
              <dd className="min-w-0 truncate text-slate-700">{cellules[i]}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function CartePied({ colonnes, pied }: { colonnes: ColonneTableur[]; pied: ReactNode[] }) {
  const estVide = (v: ReactNode) => v === "" || v === null || v === undefined;
  const autres = colonnes
    .map((c, i) => (i > 0 && !estVide(pied[i]) ? `${c.titre} : ${pied[i]}` : null))
    .filter((v): v is string => v !== null);

  return (
    <div className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-900">
      {pied[0] ?? "Total"}
      {autres.length > 0 && ` · ${autres.join(" · ")}`}
    </div>
  );
}

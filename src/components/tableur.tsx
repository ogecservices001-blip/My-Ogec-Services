import type { ReactNode } from "react";

export type ColonneTableur = { titre: string; largeur?: string; droite?: boolean };

/// Tableau façon classeur Excel (en-têtes fixes, lignes alternées), même
/// rendu que le registre Devis et Audit Heures. Sans état : utilisable
/// depuis un Server Component comme depuis un Client Component.
///
/// Responsive : au-delà de `md` (les PC du bureau), le tableau classeur
/// s'affiche. En dessous (tablette/téléphone des techniciens), il cède
/// la place à une carte par ligne — même règle pour tout écran qui
/// utilise ce composant, présent ou futur, sans rien à faire de plus.
export function Tableur({
  colonnes,
  lignes,
  pied,
  vide = "Aucune ligne",
  largeurMin = 700,
}: {
  colonnes: ColonneTableur[];
  lignes: ReactNode[][];
  pied?: ReactNode[];
  vide?: string;
  largeurMin?: number;
}) {
  if (lignes.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{vide}</p>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: largeurMin }}>
          <thead>
            <tr>
              {colonnes.map((c, i) => (
                <th
                  key={i}
                  style={c.largeur ? { width: c.largeur } : undefined}
                  className={`border-b border-slate-200 px-2 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 ${
                    c.droite ? "text-right" : "text-left"
                  }`}
                >
                  {c.titre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((cellules, r) => (
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
        {lignes.map((cellules, r) => (
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

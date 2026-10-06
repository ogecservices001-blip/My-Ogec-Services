import type { ReactNode } from "react";

export type ColonneTableur = { titre: string; largeur?: string; droite?: boolean };

/// Tableau façon classeur Excel (en-têtes fixes, lignes alternées), même
/// rendu que le registre Devis et Audit Heures. Sans état : utilisable
/// depuis un Server Component comme depuis un Client Component.
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
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
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
  );
}

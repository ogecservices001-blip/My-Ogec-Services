"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Tables } from "@/lib/types";
import { supprimerDevis } from "../../actions";

type Devis = Tables<"devis">;

export type LiensDevis = { nbCommandes: number; nbBons: number; nbCreneaux: number };

/// Le contenu d'un devis se corrige par "Réviser" ; ici on ne fait plus que
/// le supprimer, après confirmation.
export function ModaleSuppressionDevis({
  devis,
  liens,
  onClose,
}: {
  devis: Devis;
  liens: LiensDevis;
  onClose: () => void;
}) {
  const router = useRouter();
  const suppressionBloquee = liens.nbCommandes > 0;
  const liensPerdus = [
    liens.nbBons > 0 ? `Bons d'intervention liés : ${liens.nbBons}` : "",
    liens.nbCreneaux > 0 ? `Créneaux de planning liés : ${liens.nbCreneaux}` : "",
  ].filter(Boolean);
  const [suppression, startSuppression] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Supprimer le devis</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        {suppressionBloquee ? (
          <p className="text-sm text-slate-600">
            Suppression impossible : commandes fournisseur liées à ce devis ({liens.nbCommandes}).
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-red-800">
              Supprimer définitivement le devis &quot;{devis.numero || devis.libelle || "sans référence"}&quot; ? Cette action est irréversible.
            </p>
            {liensPerdus.length > 0 && (
              <div className="mb-2 text-sm font-semibold text-red-800">
                <p>Ces éléments seront conservés, mais ne seront plus rattachés à ce devis :</p>
                <ul className="mt-1 list-disc pl-5">
                  {liensPerdus.map((lien) => (
                    <li key={lien}>{lien}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={suppression}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          {!suppressionBloquee && (
            <button
              disabled={suppression}
              onClick={() =>
                startSuppression(async () => {
                  const res = await supprimerDevis(devis.id);
                  if (!res.ok) {
                    setErreur(res.erreur);
                    return;
                  }
                  router.push("/devis");
                  router.refresh();
                })
              }
              className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
            >
              {suppression ? "Suppression..." : "Supprimer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

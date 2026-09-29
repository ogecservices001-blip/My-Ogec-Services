"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileSpreadsheet, AlertTriangle } from "lucide-react";
import {
  previsualiserImportHeures,
  remplacerReferencesHoraires,
  type ResultatPreviewHeures,
} from "./import-actions";

export function ModaleImport({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [analyse, startAnalyse] = useTransition();
  const [application, startApplication] = useTransition();
  const [apercu, setApercu] = useState<Extract<ResultatPreviewHeures, { ok: true }> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function analyser(formData: FormData) {
    setErreur(null);
    startAnalyse(async () => {
      const res = await previsualiserImportHeures(formData);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setApercu(res);
    });
  }

  function confirmer() {
    if (!apercu) return;
    setErreur(null);
    startApplication(async () => {
      const res = await remplacerReferencesHoraires(apercu.lignes);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Importer le classeur d&apos;heures</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        {erreur && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>
        )}

        {!apercu && (
          <form
            action={analyser}
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
          >
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <input
              type="file"
              name="fichier"
              accept=".xlsx,.xlsm,.xls"
              required
              className="mx-auto mb-4 block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
            <button
              type="submit"
              disabled={analyse}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
            >
              <Upload className="h-4 w-4" strokeWidth={2} />
              {analyse ? "Analyse..." : "Analyser le fichier"}
            </button>
          </form>
        )}

        {apercu && (
          <>
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
              <p className="text-sm text-amber-800">
                Cette action <strong>remplace tout le référentiel existant</strong> ({apercu.nbExistantes}{" "}
                référence(s) actuelle(s)) par les {apercu.lignes.length} ligne(s) valides de ce
                fichier. Irréversible.
              </p>
            </div>

            {apercu.avertissements.length > 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Lignes ignorées ({apercu.avertissements.length})
                </p>
                <div className="max-h-32 space-y-0.5 overflow-y-auto">
                  {apercu.avertissements.map((a, i) => (
                    <p key={i} className="text-xs text-slate-600">
                      {a}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApercu(null)}
                disabled={application}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmer}
                disabled={application}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                {application ? "Remplacement..." : "Confirmer le remplacement"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

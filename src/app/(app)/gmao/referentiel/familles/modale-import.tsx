"use client";

import { useChampManquant } from "@/components/champ-manquant";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { nomFichierAvecDate } from "@/lib/excel-export";
import { previsualiserImportFamilles, appliquerImportFamilles, type ApercuImportFamilles } from "./import-actions";

export function ModaleImportFamilles({ onClose }: { onClose: () => void }) {
  const { surChampInvalide, fenetre } = useChampManquant();
  const router = useRouter();
  const [analyse, startAnalyse] = useTransition();
  const [application, startApplication] = useTransition();
  const [apercu, setApercu] = useState<Extract<ApercuImportFamilles, { ok: true }> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState<number | null>(null);
  const fichierRef = useRef<FormData | null>(null);

  function analyser(formData: FormData) {
    setErreur(null);
    fichierRef.current = formData;
    startAnalyse(async () => {
      const res = await previsualiserImportFamilles(formData);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setApercu(res);
    });
  }

  function confirmer() {
    if (!fichierRef.current) return;
    setErreur(null);
    startApplication(async () => {
      const res = await appliquerImportFamilles(fichierRef.current!);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setTermine(res.nbEcrites);
      router.refresh();
    });
  }

  function telechargerRapport() {
    if (!apercu) return;
    const octets = atob(apercu.rapport);
    const tampon = new Uint8Array(octets.length);
    for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
    const url = URL.createObjectURL(
      new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    );
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichierAvecDate("rapport_import_referentiel_equipements.xlsx");
    lien.click();
    URL.revokeObjectURL(url);
  }

  const boutonRapport = (
    <button
      type="button"
      onClick={telechargerRapport}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
      Télécharger le rapport (.xlsx)
    </button>
  );

  const touchees = apercu?.resumes.filter((r) => r.nouvelle || r.changements.length > 0) ?? [];
  const inchangees = (apercu?.resumes.length ?? 0) - touchees.length;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Importer le référentiel équipements</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

        {termine !== null ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-brand-green" />
            <p className="mb-4 text-sm text-slate-700">
              {termine === 0 ? "Aucun changement à enregistrer." : `${termine} famille(s) enregistrée(s).`}
            </p>
            <div className="mb-4">{boutonRapport}</div>
            <button onClick={onClose} className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark">
              Fermer
            </button>
          </div>
        ) : !apercu ? (
          <form
            onInvalidCapture={surChampInvalide}
            action={analyser}
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
          >
            {fenetre}
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="mb-3 text-xs text-slate-500">
              Pars du fichier de l&apos;export Excel. Ne modifie pas les colonnes « Repère ». Une ligne sans repère est un nouvel
              élément. Rien n&apos;est supprimé.
            </p>
            <input
              type="file"
              name="fichier"
              accept=".xlsx"
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
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-700">
                {touchees.length === 0
                  ? "Aucun changement par rapport au référentiel actuel"
                  : `${touchees.length} famille(s) à enregistrer`}
                {inchangees > 0 && touchees.length > 0 && `, ${inchangees} inchangée(s)`}.
              </p>
              {boutonRapport}
            </div>

            {touchees.length > 0 && (
              <div className="mb-4 max-h-80 space-y-2 overflow-y-auto">
                {touchees.map((r) => (
                  <div key={r.code} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-900">
                      {r.code} — {r.nom}
                      {r.nouvelle && (
                        <span className="ml-2 rounded bg-brand-green/10 px-1.5 py-0.5 text-xs font-semibold text-brand-green-dark">
                          Nouvelle famille
                        </span>
                      )}
                    </p>
                    {r.changements.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {r.changements.map((c, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            • {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {apercu.avertissements.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
                  À savoir ({apercu.avertissements.length})
                </p>
                <div className="max-h-32 space-y-0.5 overflow-y-auto">
                  {apercu.avertissements.map((a, i) => (
                    <p key={i} className="text-xs text-amber-800">
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
              {touchees.length > 0 && (
                <button
                  onClick={confirmer}
                  disabled={application}
                  className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
                >
                  {application ? "Enregistrement..." : "Confirmer l'import"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

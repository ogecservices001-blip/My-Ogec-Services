"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet } from "lucide-react";
import { previsualiserImportPlanning, appliquerImportPlanning, type ResultatDiffPlanning } from "../import-actions";

type ResultatApplique = { ajoutes: number; modifies: number; echecs: string[] };

export function ImporterPlanningClient() {
  const router = useRouter();
  const [analyse, startAnalyse] = useTransition();
  const [application, startApplication] = useTransition();
  const [diff, setDiff] = useState<ResultatDiffPlanning | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cochesAjouts, setCochesAjouts] = useState<boolean[]>([]);
  const [cochesModifications, setCochesModifications] = useState<boolean[]>([]);
  const [resultat, setResultat] = useState<ResultatApplique | null>(null);

  function analyser(formData: FormData) {
    setErreur(null);
    setResultat(null);
    startAnalyse(async () => {
      const res = await previsualiserImportPlanning(formData);
      if (!res.ok) {
        setErreur(res.erreur);
        setDiff(null);
        return;
      }
      setDiff(res.diff);
      setCochesAjouts(res.diff.ajouts.map(() => true));
      setCochesModifications(res.diff.modifications.map(() => true));
    });
  }

  function appliquer() {
    if (!diff) return;
    setErreur(null);
    startApplication(async () => {
      const res = await appliquerImportPlanning(diff, { ajouts: cochesAjouts, modifications: cochesModifications });
      setResultat({ ajoutes: res.ajoutes, modifies: res.modifies, echecs: res.echecs });
      setDiff(null);
      router.refresh();
    });
  }

  function bascule(liste: boolean[], setListe: (v: boolean[]) => void, i: number) {
    const copie = [...liste];
    copie[i] = !copie[i];
    setListe(copie);
  }

  const totalCoches = cochesAjouts.filter(Boolean).length + cochesModifications.filter(Boolean).length;

  return (
    <div>
      <Link
        href="/planning"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Importer le planning</h1>
      <p className="mb-5 text-sm text-slate-500">
        Même format que l&apos;export (Date inter Prog Client) — une ligne par date/affaire, rapprochement par date + N° Affaire.
      </p>

      {resultat && (
        <div className="mb-4 space-y-2">
          <p className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-brand-green-dark">
            Import appliqué : {resultat.ajoutes} créneau(x) ajouté(s), {resultat.modifies} modifié(s).
          </p>
          {resultat.echecs.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">
                {resultat.echecs.length} ligne(s) en échec
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {resultat.echecs.map((e, i) => (
                  <p key={i} className="text-xs text-red-800">
                    {e}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {!diff && (
        <form action={analyser} className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
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

      {diff && (
        <>
          {diff.ajouts.length === 0 && diff.modifications.length === 0 && (
            <p className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">Aucun changement détecté.</p>
          )}

          {diff.avertissements.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                Avertissements ({diff.avertissements.length})
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {diff.avertissements.map((a, i) => (
                  <p key={i} className="text-xs text-amber-800">
                    {a.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {diff.ajouts.length > 0 && (
            <Section titre={`Ajouts (${diff.ajouts.length})`} couleur="text-brand-green-dark">
              {diff.ajouts.map((a, i) => (
                <Ligne
                  key={i}
                  cochee={cochesAjouts[i]}
                  onToggle={() => bascule(cochesAjouts, setCochesAjouts, i)}
                  titre={`${a.clientNom} — ${a.site}`}
                  sousTitre={`${a.ligne.date} — ${a.ligne.heuresPrevues}h — ${a.ligne.intervenants.join(", ")}`}
                />
              ))}
            </Section>
          )}

          {diff.modifications.length > 0 && (
            <Section titre={`Modifications (${diff.modifications.length})`} couleur="text-amber-600">
              {diff.modifications.map((m, i) => (
                <Ligne
                  key={i}
                  cochee={cochesModifications[i]}
                  onToggle={() => bascule(cochesModifications, setCochesModifications, i)}
                  titre={`${m.clientNom} — ${m.site}`}
                  sousTitre={`${m.ligne.date} — ${m.champs.map((c) => `${c.label} : "${c.ancienne}" → "${c.nouvelle}"`).join(" | ")}`}
                  multiline
                />
              ))}
            </Section>
          )}

          {(diff.ajouts.length > 0 || diff.modifications.length > 0) && (
            <div className="sticky bottom-4 mt-4 flex justify-end">
              <button
                onClick={appliquer}
                disabled={application || totalCoches === 0}
                className="rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-green-dark disabled:opacity-60"
              >
                {application ? "Application..." : `Appliquer (${totalCoches})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ titre, couleur, children }: { titre: string; couleur: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className={`mb-2 text-xs font-bold uppercase tracking-wide ${couleur}`}>{titre}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Ligne({
  cochee,
  onToggle,
  titre,
  sousTitre,
  multiline,
}: {
  cochee: boolean;
  onToggle: () => void;
  titre: string;
  sousTitre: string;
  multiline?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3">
      <input type="checkbox" checked={cochee} onChange={onToggle} className="mt-1 h-4 w-4 accent-brand-green" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{titre}</p>
        {sousTitre && <p className={`mt-0.5 text-xs text-slate-500 ${multiline ? "whitespace-pre-line" : "truncate"}`}>{sousTitre}</p>}
      </div>
    </label>
  );
}

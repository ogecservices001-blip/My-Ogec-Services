"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet } from "lucide-react";
import {
  previsualiserImportFournisseurs,
  appliquerImportFournisseurs,
  type LigneDiffFournisseur,
} from "../import-actions";

export function ImporterFournisseursClient() {
  const router = useRouter();
  const [analyse, startAnalyse] = useTransition();
  const [application, startApplication] = useTransition();
  const [lignes, setLignes] = useState<LigneDiffFournisseur[] | null>(null);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cochees, setCochees] = useState<Set<number>>(new Set());
  const [resultat, setResultat] = useState<{ ajoutes: number; modifies: number } | null>(null);

  function analyser(formData: FormData) {
    setErreur(null);
    setResultat(null);
    startAnalyse(async () => {
      const res = await previsualiserImportFournisseurs(formData);
      if (!res.ok) {
        setErreur(res.erreur);
        setLignes(null);
        return;
      }
      setLignes(res.lignes);
      setAvertissements(res.avertissements);
      setCochees(new Set(res.lignes.map((_, i) => i)));
    });
  }

  function appliquer() {
    if (!lignes) return;
    setErreur(null);
    startApplication(async () => {
      const selection = lignes.filter((_, i) => cochees.has(i));
      const res = await appliquerImportFournisseurs(selection);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setResultat({ ajoutes: res.ajoutes ?? 0, modifies: res.modifies ?? 0 });
      setLignes(null);
      router.refresh();
    });
  }

  return (
    <div>
      <Link
        href="/repertoire/fournisseurs"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Importer des fournisseurs
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Fichier CSV (point-virgule ou virgule), 12 colonnes minimum. Rapprochement par nom.
      </p>

      {resultat && (
        <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-brand-green-dark">
          Import terminé : {resultat.ajoutes} fournisseur(s) ajouté(s), {resultat.modifies}{" "}
          mis à jour.
        </p>
      )}

      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>
      )}

      {!lignes && (
        <form
          action={analyser}
          className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
        >
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <input
            type="file"
            name="fichier"
            accept=".csv"
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

      {avertissements.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
            Avertissements ({avertissements.length})
          </p>
          {avertissements.map((a, i) => (
            <p key={i} className="text-sm text-amber-800">
              {a}
            </p>
          ))}
        </div>
      )}

      {lignes && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {lignes.filter((l) => l.statut === "ajout").length} ajout(s),{" "}
              {lignes.filter((l) => l.statut === "modification").length} modification(s) —{" "}
              {cochees.size} sélectionné(s)
            </p>
            <button
              onClick={appliquer}
              disabled={application || cochees.size === 0}
              className="rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
            >
              {application ? "Application..." : `Appliquer (${cochees.size})`}
            </button>
          </div>

          <ul className="space-y-2">
            {lignes.map((ligne, i) => (
              <li key={i} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                <label className="flex cursor-pointer items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={cochees.has(i)}
                    onChange={(e) =>
                      setCochees((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        return next;
                      })
                    }
                    className="mt-1 h-4 w-4 accent-brand-green"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          ligne.statut === "ajout"
                            ? "bg-green-100 text-brand-green-dark"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ligne.statut === "ajout" ? "Ajout" : "Modification"}
                      </span>
                      <span className="truncate font-semibold text-slate-900">
                        {ligne.donnees.nom}
                      </span>
                    </div>
                    {ligne.differences.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {ligne.differences.map(([label, ancienne, nouvelle], j) => (
                          <p key={j} className="text-xs text-slate-500">
                            <span className="font-medium">{label}</span> :{" "}
                            {ancienne ? `"${ancienne}"` : "(vide)"} → &quot;{nouvelle}&quot;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

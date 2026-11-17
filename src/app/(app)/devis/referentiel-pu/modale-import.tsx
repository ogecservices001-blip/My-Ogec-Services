"use client";

import { useChampManquant } from "@/components/champ-manquant";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { dateFrPU, formatNombrePU } from "@/lib/devis/referentiel-pu";
import { appliquerImportPU, previsualiserImportPU, type ApercuImportPU } from "./import-actions";

function euros(v: number | null): string {
  return v === null ? "—" : `${formatNombrePU(v)} €`;
}

function Section({
  titre,
  couleur,
  nb,
  aide,
  children,
}: {
  titre: string;
  couleur: string;
  nb: number;
  aide?: string;
  children: ReactNode;
}) {
  if (nb === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-slate-200">
      <div className={`rounded-t-xl px-4 py-2 text-sm font-bold ${couleur}`}>
        {titre} ({nb}){aide && <span className="ml-2 font-normal">{aide}</span>}
      </div>
      <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{children}</div>
    </div>
  );
}

function Ligne({ coche, onChange, children }: { coche: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-2 text-sm hover:bg-slate-50">
      <input type="checkbox" checked={coche} onChange={onChange} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-green" />
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

function basculer(set: Set<number>, i: number): Set<number> {
  const n = new Set(set);
  if (n.has(i)) n.delete(i);
  else n.add(i);
  return n;
}

export function ModaleImportPU({ onClose }: { onClose: () => void }) {
  const { surChampInvalide, fenetre } = useChampManquant();
  const router = useRouter();
  const [analyse, startAnalyse] = useTransition();
  const [application, startApplication] = useTransition();
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<ApercuImportPU | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [ajoutsDecoches, setAjoutsDecoches] = useState<Set<number>>(new Set());
  const [modificationsDecochees, setModificationsDecochees] = useState<Set<number>>(new Set());
  const [absentsCoches, setAbsentsCoches] = useState<Set<number>>(new Set());

  function formDataFichier(f: File): FormData {
    const fd = new FormData();
    fd.set("fichier", f);
    return fd;
  }

  function analyser(formData: FormData) {
    setErreur(null);
    const f = formData.get("fichier");
    if (!(f instanceof File)) return;
    startAnalyse(async () => {
      const res = await previsualiserImportPU(formData);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setFichier(f);
      setApercu(res.apercu);
      setAjoutsDecoches(new Set());
      setModificationsDecochees(new Set());
      setAbsentsCoches(new Set());
    });
  }

  function appliquer() {
    if (!apercu || !fichier) return;
    setErreur(null);
    startApplication(async () => {
      const res = await appliquerImportPU(
        formDataFichier(fichier),
        {
          ajoutsDecoches: [...ajoutsDecoches],
          modificationsDecochees: [...modificationsDecochees],
          absentsCoches: [...absentsCoches],
        },
        apercu.empreinte,
      );
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setResultat(
        `${res.ajoutes ?? 0} article(s) ajouté(s), ${res.modifies ?? 0} modifié(s), ${res.supprimes ?? 0} supprimé(s).`,
      );
      router.refresh();
    });
  }

  const rienAChanger =
    apercu !== null &&
    apercu.ajouts.length === 0 &&
    apercu.modifications.length === 0 &&
    apercu.absents.length === 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Importer le Référentiel PU</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

        {resultat && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
              <p className="text-sm text-emerald-800">Import appliqué : {resultat}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {!apercu && !resultat && (
          <form
            onInvalidCapture={surChampInvalide}
            action={analyser}
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
          >
            {fenetre}
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="mb-3 text-xs text-slate-500">
              Colonnes attendues en ligne 1 : Famille, Type, Donnée 1 à Donnée 6, Tarif net HT, MO, Date mise à jour tarif (facultative)
            </p>
            <input
              type="file"
              name="fichier"
              accept=".xlsx,.xlsm"
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

        {apercu && !resultat && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              {apercu.nbLignesFichier} article(s) dans le fichier, {apercu.nbExistants} dans le référentiel actuel.
              {rienAChanger && " Aucun changement de prix, de MO ou d'article : le référentiel est déjà à jour."}
            </p>

            <Section titre="Nouveaux articles" couleur="bg-emerald-50 text-emerald-800" nb={apercu.ajouts.length}>
              {apercu.ajouts.map((a, i) => (
                <Ligne key={i} coche={!ajoutsDecoches.has(i)} onChange={() => setAjoutsDecoches((s) => basculer(s, i))}>
                  <p className="font-medium text-slate-900">{a.libelle}</p>
                  <p className="text-xs text-slate-500">
                    {a.famille} — {a.unite || "sans unité"} — {euros(a.tarif)} — MO {a.mo === null ? "—" : `${formatNombrePU(a.mo)} h`}
                    {a.date && ` — tarif du ${dateFrPU(a.date)}`}
                  </p>
                </Ligne>
              ))}
            </Section>

            <Section titre="Modifiés" couleur="bg-amber-50 text-amber-800" nb={apercu.modifications.length} aide="— prix, MO ou date de tarif">
              {apercu.modifications.map((m, i) => (
                <Ligne
                  key={i}
                  coche={!modificationsDecochees.has(i)}
                  onChange={() => setModificationsDecochees((s) => basculer(s, i))}
                >
                  <p className="font-medium text-slate-900">{m.libelle}</p>
                  <p className="text-xs text-slate-500">
                    {m.famille}
                    {m.ancienTarif !== m.nouveauTarif && (
                      <>
                        {" — "}Tarif <span className="line-through">{euros(m.ancienTarif)}</span> →{" "}
                        <strong className="text-slate-800">{euros(m.nouveauTarif)}</strong>
                      </>
                    )}
                    {m.ancienneMO !== m.nouvelleMO && (
                      <>
                        {" — "}MO <span className="line-through">{formatNombrePU(m.ancienneMO) || "—"}</span> →{" "}
                        <strong className="text-slate-800">{formatNombrePU(m.nouvelleMO) || "—"}</strong>
                      </>
                    )}
                    {m.ancienneDate !== m.nouvelleDate && (
                      <>
                        {" — "}Date tarif <span className="line-through">{dateFrPU(m.ancienneDate) || "—"}</span> →{" "}
                        <strong className="text-slate-800">{dateFrPU(m.nouvelleDate) || "—"}</strong>
                      </>
                    )}
                  </p>
                </Ligne>
              ))}
            </Section>

            <Section
              titre="Absents du fichier"
              couleur="bg-red-50 text-red-800"
              nb={apercu.absents.length}
              aide="— coche ceux à supprimer du référentiel"
            >
              {apercu.absents.map((a, i) => (
                <Ligne key={i} coche={absentsCoches.has(i)} onChange={() => setAbsentsCoches((s) => basculer(s, i))}>
                  <p className="font-medium text-slate-900">{a.libelle}</p>
                  <p className="text-xs text-slate-500">
                    {a.famille} — {euros(a.tarif)}
                  </p>
                </Ligne>
              ))}
            </Section>

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
                Autre fichier
              </button>
              <button
                onClick={appliquer}
                disabled={application}
                className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
              >
                {application ? "Application..." : "Appliquer l'import"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet, Download } from "lucide-react";
import type { ResumeImportEquipements } from "./import-shared";
import { previsualiserImportEquipements, appliquerImportEquipements, genererRapportImportEquipements } from "./import-shared";

/// Écran d'import "Sommaire" générique, réutilisé pour un import par
/// site, par client (plusieurs sites) ou global (tous les sites) —
/// seuls `siteIds`/`cheminsARevalider` changent selon l'ampleur.
///
/// L'analyse complète (toutes les lignes à ajouter/modifier) ne quitte
/// jamais le serveur — ce composant ne manipule qu'un résumé plafonné
/// (`resume.limiteDetail` lignes en détail par catégorie) identifié par
/// `resume.id`. Sur un import "tous clients" (plusieurs milliers de
/// lignes), faire transiter l'analyse complète par le navigateur à
/// chaque aller-retour (analyse → applique → rapport) faisait planter
/// l'onglet.
export function ImporterEquipementsClient({
  titre,
  sousTitre,
  siteIds,
  retourHref,
  cheminsARevalider,
}: {
  titre: string;
  sousTitre: string;
  siteIds: string[];
  retourHref: string;
  cheminsARevalider: string[];
}) {
  const router = useRouter();
  const [analyse, startAnalyse] = useTransition();
  const [application, startApplication] = useTransition();
  const [rapport, startRapport] = useTransition();
  const [resume, setResume] = useState<ResumeImportEquipements | null>(null);
  const [resumeApplique, setResumeApplique] = useState<ResumeImportEquipements | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cochesAjouts, setCochesAjouts] = useState<boolean[]>([]);
  const [cochesModifications, setCochesModifications] = useState<boolean[]>([]);
  const [cochesSuppressions, setCochesSuppressions] = useState<boolean[]>([]);
  const [resultat, setResultat] = useState<{ ajoutes: number; modifies: number; supprimes: number } | null>(null);

  function analyser(formData: FormData) {
    setErreur(null);
    setResultat(null);
    startAnalyse(async () => {
      const res = await previsualiserImportEquipements(siteIds, formData);
      if (!res.ok) {
        setErreur(res.erreur);
        setResume(null);
        return;
      }
      setResume(res.resume);
      setCochesAjouts(res.resume.apercuAjouts.map(() => true));
      setCochesModifications(res.resume.apercuModifications.map(() => true));
      // Les suppressions ne sont jamais cochées par défaut — action
      // destructive, opt-in explicite requis (garde-fou que Flutter
      // lui-même n'avait pas).
      setCochesSuppressions(res.resume.apercuSuppressions.map(() => false));
    });
  }

  function appliquer() {
    if (!resume) return;
    setErreur(null);
    startApplication(async () => {
      const res = await appliquerImportEquipements(
        resume.id,
        { ajouts: cochesAjouts, modifications: cochesModifications, suppressions: cochesSuppressions },
        cheminsARevalider,
      );
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setResultat({ ajoutes: res.ajoutes ?? 0, modifies: res.modifies ?? 0, supprimes: res.supprimes ?? 0 });
      setResumeApplique(resume);
      setResume(null);
      router.refresh();
    });
  }

  function telechargerRapport(resumeATelecharger: ResumeImportEquipements | null) {
    if (!resumeATelecharger) return;
    setErreur(null);
    startRapport(async () => {
      const res = await genererRapportImportEquipements(resumeATelecharger.id);
      if (!res.ok || !res.base64) {
        setErreur(!res.ok ? res.erreur : "Rapport indisponible.");
        return;
      }
      const octets = atob(res.base64);
      const tampon = new Uint8Array(octets.length);
      for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = "rapport_import_equipements.xlsx";
      lien.click();
      URL.revokeObjectURL(url);
    });
  }

  function bascule(liste: boolean[], setListe: (v: boolean[]) => void, i: number) {
    const copie = [...liste];
    copie[i] = !copie[i];
    setListe(copie);
  }

  const totalCoches =
    cochesAjouts.filter(Boolean).length +
    cochesModifications.filter(Boolean).length +
    cochesSuppressions.filter(Boolean).length +
    // Au-delà du détail affiché, tout ajout/modification reste inclus
    // par défaut (même convention que côté serveur) — compté ici pour
    // que le bouton "Appliquer (N)" reflète le total réel.
    Math.max(0, resume ? resume.compteAjouts - cochesAjouts.length : 0) +
    Math.max(0, resume ? resume.compteModifications - cochesModifications.length : 0);

  return (
    <div>
      <Link
        href={retourHref}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{titre}</h1>
      <p className="mb-5 text-sm text-slate-500">{sousTitre}</p>

      {resultat && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-green-dark">
            Import appliqué : {resultat.ajoutes} ajouté(s), {resultat.modifies} modifié(s), {resultat.supprimes}{" "}
            supprimé(s).
          </p>
          <button
            onClick={() => telechargerRapport(resumeApplique)}
            disabled={rapport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-green-dark shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
            {rapport ? "Génération..." : "Télécharger le rapport (.xlsx)"}
          </button>
        </div>
      )}
      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {!resume && (
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

      {resume && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              {resume.compteAjouts === 0 && resume.compteModifications === 0 && resume.compteSuppressions === 0
                ? "Aucun changement détecté — le parc est déjà à jour."
                : `${resume.compteAjouts} ajout(s), ${resume.compteModifications} modification(s).`}
            </p>
            <button
              onClick={() => telechargerRapport(resume)}
              disabled={rapport}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
              {rapport ? "Génération..." : "Télécharger le rapport (.xlsx)"}
            </button>
          </div>

          {resume.avertissements.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                Avertissements ({resume.avertissements.length})
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {resume.avertissements.map((message, i) => (
                  <p key={i} className="text-xs text-amber-800">
                    {message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {resume.compteAjouts > 0 && (
            <Section titre={`Ajouts (${resume.compteAjouts})`} couleur="text-brand-green-dark">
              {resume.apercuAjouts.map((a, i) => (
                <Ligne
                  key={i}
                  cochee={cochesAjouts[i]}
                  onToggle={() => bascule(cochesAjouts, setCochesAjouts, i)}
                  titre={a.nom}
                  sousTitre={[a.typeDeReleveBrut, a.numeroEquipement, a.localisation].filter(Boolean).join(" — ")}
                />
              ))}
              {resume.compteAjouts > resume.limiteDetail && (
                <NoteTropDeLignes total={resume.compteAjouts} affiches={resume.limiteDetail} />
              )}
            </Section>
          )}

          {resume.compteModifications > 0 && (
            <Section titre={`Modifications (${resume.compteModifications})`} couleur="text-amber-600">
              {resume.apercuModifications.map((m, i) => (
                <Ligne
                  key={i}
                  cochee={cochesModifications[i]}
                  onToggle={() => bascule(cochesModifications, setCochesModifications, i)}
                  titre={m.nom}
                  sousTitre={m.champs.map((c) => `${c.label} : "${c.ancienne}" → "${c.nouvelle}"`).join("\n")}
                  multiline
                />
              ))}
              {resume.compteModifications > resume.limiteDetail && (
                <NoteTropDeLignes total={resume.compteModifications} affiches={resume.limiteDetail} />
              )}
            </Section>
          )}

          {resume.compteSuppressions > 0 && (
            <Section titre={`Suppressions proposées (${resume.compteSuppressions})`} couleur="text-red-600">
              {resume.apercuSuppressions.map((s, i) => (
                <Ligne
                  key={i}
                  cochee={cochesSuppressions[i]}
                  onToggle={() => bascule(cochesSuppressions, setCochesSuppressions, i)}
                  titre={s.nom}
                  sousTitre={`Absent du fichier importé — ${s.numeroEquipement}`}
                />
              ))}
              {resume.compteSuppressions > resume.limiteDetail && (
                <p className="rounded-xl border border-dashed border-red-300 bg-red-50 p-3 text-xs text-red-700">
                  + {resume.compteSuppressions - resume.limiteDetail} autre(s) suppression(s) proposée(s) non
                  affichée(s) — non cochées par défaut, à traiter via un import plus ciblé si besoin.
                </p>
              )}
            </Section>
          )}

          {(resume.compteAjouts > 0 || resume.compteModifications > 0 || resume.compteSuppressions > 0) && (
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

function NoteTropDeLignes({ total, affiches }: { total: number; affiches: number }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
      + {total - affiches} autre(s) ligne(s) non affichée(s) ici (trop nombreuses pour l&apos;écran) — toutes
      restent sélectionnées et seront appliquées. Détail complet dans le rapport (.xlsx).
    </p>
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
      <input
        type="checkbox"
        checked={cochee}
        onChange={onToggle}
        className="mt-1 h-4 w-4 accent-brand-green"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{titre}</p>
        {sousTitre && (
          <p className={`mt-0.5 text-xs text-slate-500 ${multiline ? "whitespace-pre-line" : "truncate"}`}>
            {sousTitre}
          </p>
        )}
      </div>
    </label>
  );
}

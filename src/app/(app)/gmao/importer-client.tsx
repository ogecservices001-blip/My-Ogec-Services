"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileSpreadsheet, Download } from "lucide-react";
import type { ResultatDiff } from "@/lib/gmao/equipement-import";
import { previsualiserImportEquipements, appliquerImportEquipements, genererRapportImportEquipements } from "./import-shared";
import { nomFichierAvecDate } from "@/lib/excel-export";

// Au-delà de ce nombre, afficher chaque ligne individuellement (carte +
// case à cocher) sature le navigateur sur un import "tous clients"
// (plusieurs milliers de lignes) — toutes les lignes restent sélectionnées
// et appliquées normalement, seul l'affichage détaillé est tronqué.
const LIMITE_AFFICHAGE = 300;

/// Écran d'import "Sommaire" générique, réutilisé pour un import par
/// site, par client (plusieurs sites) ou global (tous les sites) —
/// seuls `siteIds`/`cheminsARevalider` changent selon l'ampleur.
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
  const [diff, setDiff] = useState<ResultatDiff | null>(null);
  const [diffApplique, setDiffApplique] = useState<ResultatDiff | null>(null);
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
        setDiff(null);
        return;
      }
      setDiff(res.diff);
      setCochesAjouts(res.diff.ajouts.map(() => true));
      setCochesModifications(res.diff.modifications.map(() => true));
      // Les suppressions ne sont jamais cochées par défaut — action
      // destructive, opt-in explicite requis (garde-fou que Flutter
      // lui-même n'avait pas).
      setCochesSuppressions(res.diff.suppressions.map(() => false));
    });
  }

  function appliquer() {
    if (!diff) return;
    setErreur(null);
    startApplication(async () => {
      const res = await appliquerImportEquipements(
        diff,
        { ajouts: cochesAjouts, modifications: cochesModifications, suppressions: cochesSuppressions },
        cheminsARevalider,
      );
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setResultat({ ajoutes: res.ajoutes ?? 0, modifies: res.modifies ?? 0, supprimes: res.supprimes ?? 0 });
      setDiffApplique(diff);
      setDiff(null);
      router.refresh();
    });
  }

  function telechargerRapport(diffATelecharger: ResultatDiff | null) {
    if (!diffATelecharger) return;
    setErreur(null);
    startRapport(async () => {
      const res = await genererRapportImportEquipements(diffATelecharger);
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
      lien.download = nomFichierAvecDate("rapport_import_equipements.xlsx");
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
    cochesSuppressions.filter(Boolean).length;

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
            onClick={() => telechargerRapport(diffApplique)}
            disabled={rapport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-green-dark shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
            {rapport ? "Génération..." : "Télécharger le rapport (.xlsx)"}
          </button>
        </div>
      )}
      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {!diff && (
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

      {diff && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              {diff.ajouts.length === 0 && diff.modifications.length === 0 && diff.suppressions.length === 0
                ? "Aucun changement détecté — le parc est déjà à jour."
                : `${diff.ajouts.length} ajout(s), ${diff.modifications.length} modification(s).`}
            </p>
            <button
              onClick={() => telechargerRapport(diff)}
              disabled={rapport}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
              {rapport ? "Génération..." : "Télécharger le rapport (.xlsx)"}
            </button>
          </div>

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
              {diff.ajouts.slice(0, LIMITE_AFFICHAGE).map((a, i) => (
                <Ligne
                  key={i}
                  cochee={cochesAjouts[i]}
                  onToggle={() => bascule(cochesAjouts, setCochesAjouts, i)}
                  titre={a.ligne.nom}
                  sousTitre={[a.ligne.typeDeReleveBrut, a.ligne.numeroEquipement, a.ligne.localisation]
                    .filter(Boolean)
                    .join(" — ")}
                />
              ))}
              {diff.ajouts.length > LIMITE_AFFICHAGE && (
                <NoteTropDeLignes total={diff.ajouts.length} affiches={LIMITE_AFFICHAGE} />
              )}
            </Section>
          )}

          {diff.modifications.length > 0 && (
            <Section titre={`Modifications (${diff.modifications.length})`} couleur="text-amber-600">
              {diff.modifications.slice(0, LIMITE_AFFICHAGE).map((m, i) => (
                <Ligne
                  key={i}
                  cochee={cochesModifications[i]}
                  onToggle={() => bascule(cochesModifications, setCochesModifications, i)}
                  titre={m.existant.nom}
                  sousTitre={m.champs.map((c) => `${c.label} : "${c.ancienne}" → "${c.nouvelle}"`).join("\n")}
                  multiline
                />
              ))}
              {diff.modifications.length > LIMITE_AFFICHAGE && (
                <NoteTropDeLignes total={diff.modifications.length} affiches={LIMITE_AFFICHAGE} />
              )}
            </Section>
          )}

          {diff.suppressions.length > 0 && (
            <Section titre={`Suppressions proposées (${diff.suppressions.length})`} couleur="text-red-600">
              {diff.suppressions.slice(0, LIMITE_AFFICHAGE).map((s, i) => (
                <Ligne
                  key={i}
                  cochee={cochesSuppressions[i]}
                  onToggle={() => bascule(cochesSuppressions, setCochesSuppressions, i)}
                  titre={s.existant.nom}
                  sousTitre={`Absent du fichier importé — ${s.existant.numero_equipement}`}
                />
              ))}
              {diff.suppressions.length > LIMITE_AFFICHAGE && (
                <NoteTropDeLignes total={diff.suppressions.length} affiches={LIMITE_AFFICHAGE} />
              )}
            </Section>
          )}

          {(diff.ajouts.length > 0 || diff.modifications.length > 0 || diff.suppressions.length > 0) && (
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

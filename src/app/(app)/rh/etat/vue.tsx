"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileText, Lock, RotateCcw } from "lucide-react";
import { nomFichierAvecDate } from "@/lib/excel-export";
import type { EtatPreparatoire, LigneEtatComplete } from "@/lib/rh/etat";
import { dateFr, finDuMois } from "@/lib/rh/mois";
import { cloturerMois } from "../actions";
import { changerDateArrete, enregistrerObservation, exporterEtat } from "./actions";

const nb = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const jourSuivant = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
const nomMois = (mois: string) => {
  const [an, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(an, m - 1, 1)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
};

function telecharger(b64: string, type: string, nom: string) {
  const octets = atob(b64);
  const tampon = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([tampon], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

function Observations({ mois, ligne, figee }: { mois: string; ligne: LigneEtatComplete; figee: boolean }) {
  const router = useRouter();
  const [texte, setTexte] = useState(ligne.observations);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  if (figee) return <p className="whitespace-pre-line text-xs text-slate-700">{ligne.observations}</p>;

  function enregistrer(valeur: string | null) {
    setErreur(null);
    startTransition(async () => {
      const r = await enregistrerObservation(mois, ligne.salarieId, valeur);
      if (!r.ok) setErreur(r.erreur);
      router.refresh();
    });
  }

  return (
    <div>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={() => texte !== ligne.observations && enregistrer(texte)}
        rows={Math.min(10, Math.max(2, texte.split("\n").length))}
        className="w-full min-w-64 rounded-lg border border-slate-200 px-2 py-1 text-xs"
        placeholder="Observations (avances sur salaire, remarques…)"
      />
      <div className="flex items-center gap-2 text-[11px]">
        {pending && <span className="text-slate-400">Enregistrement…</span>}
        {erreur && <span className="text-red-600">{erreur}</span>}
        {ligne.modifiee && !pending && (
          <button
            onClick={() => {
              setTexte(ligne.observationsAuto);
              enregistrer(null);
            }}
            className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-3 w-3" />
            Revenir au texte automatique
          </button>
        )}
      </div>
    </div>
  );
}

export function EtatVue({ etat }: { etat: EtatPreparatoire }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const figee = Boolean(etat.cloture);
  const fin = finDuMois(etat.mois);
  const regul = etat.lignes.filter((l) => l.regularisation);

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>) {
    setErreur(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setErreur(r.erreur ?? "Action impossible.");
      setConfirmer(false);
      router.refresh();
    });
  }

  function exporter(format: "xlsx" | "pdf") {
    startTransition(async () => {
      const b64 = await exporterEtat(etat.mois, format);
      telecharger(
        b64,
        format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
        nomFichierAvecDate(`Etat_preparatoire_${etat.mois}.${format}`),
      );
    });
  }

  const cellule = "border-b border-slate-100 px-2 py-2 align-top";
  const ligne = (l: LigneEtatComplete) => {
    const t = l.bloc === "technique";
    return (
      <tr key={l.salarieId}>
        <td className={`${cellule} font-semibold text-slate-900`}>{l.nom}</td>
        <td className={`${cellule} text-right`}>{nb(l.heures)}</td>
        <td className={`${cellule} text-right`}>{t ? nb(l.hs25) : ""}</td>
        <td className={`${cellule} text-right`}>{t ? nb(l.hs50) : ""}</td>
        <td className={`${cellule} whitespace-pre-line`}>{l.absences.map((a) => dateFr(a.debut)).join("\n")}</td>
        <td className={`${cellule} whitespace-pre-line`}>{l.absences.map((a) => dateFr(a.fin)).join("\n")}</td>
        <td className={`${cellule} whitespace-pre-line`}>{l.absences.map((a) => a.motif).join("\n")}</td>
        <td className={`${cellule} text-right`}>{t ? l.paniersNb : ""}</td>
        <td className={`${cellule} text-right`}>{t ? eur(l.paniersMontant) : ""}</td>
        <td className={`${cellule} text-right`}>{t ? eur(l.trajet) : ""}</td>
        <td className={`${cellule} text-right`}>{t ? eur(l.transport) : ""}</td>
        <td className={cellule}>
          <Observations key={`${l.salarieId}-${l.observations}`} mois={etat.mois} ligne={l} figee={figee} />
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">État préparatoire</h1>
          <p className="text-sm text-slate-500">
            Feuille envoyée à la RH 48 h avant la paie du 24 —{" "}
            <Link href={`/rh/pointage?mois=${etat.mois}`} className="font-semibold text-brand-green-dark underline">
              Pointage mensuel
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={etat.mois}
            onChange={(e) => e.target.value && router.push(`/rh/etat?mois=${e.target.value}`)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
          />
          <button onClick={() => exporter("xlsx")} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button onClick={() => exporter("pdf")} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <FileText className="h-4 w-4" />
            PDF
          </button>
          {!figee && (
            <button onClick={() => setConfirmer(true)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <Lock className="h-4 w-4" />
              Envoyé : clôturer le mois
            </button>
          )}
        </div>
      </div>

      {confirmer && (
        <div className="mb-3 rounded-xl border border-slate-300 bg-white p-3 text-sm">
          <p className="mb-2 font-semibold">
            Clôturer {nomMois(etat.mois)} ? L&apos;état préparatoire et le pointage jusqu&apos;au {dateFr(etat.dateArrete)} seront figés tels qu&apos;ils sont maintenant ; les
            écarts constatés ensuite seront régularisés le mois prochain.
          </p>
          <div className="flex gap-2">
            <button onClick={() => agir(() => cloturerMois(etat.mois))} disabled={pending} className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white">
              Oui, clôturer
            </button>
            <button onClick={() => setConfirmer(false)} className="rounded-lg border border-slate-200 px-3 py-1.5">
              Annuler
            </button>
          </div>
        </div>
      )}
      {erreur && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      <div className="mb-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
        {figee ? (
          <p className="text-slate-700">
            <Lock className="mr-1 inline h-4 w-4" />
            Envoyé et clôturé le {new Date(etat.cloture!.le).toLocaleDateString("fr-FR")} par {etat.cloture!.par}, arrêté au {dateFr(etat.dateArrete)} : l&apos;état est figé.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              Date d&apos;arrêté
              <input
                type="date"
                value={etat.dateArrete}
                min={`${etat.mois}-01`}
                max={fin}
                disabled={pending}
                onChange={(e) => e.target.value && agir(() => changerDateArrete(etat.mois, e.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
            {etat.dateArrete !== etat.dateArreteDefaut && (
              <button onClick={() => agir(() => changerDateArrete(etat.mois, null))} disabled={pending} className="text-xs font-semibold text-slate-500 underline">
                Revenir au {dateFr(etat.dateArreteDefaut)}
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-slate-500">
          Jusqu&apos;au {dateFr(etat.dateArrete)} : heures, paniers et déplacements réels (planning et BI).
          {etat.dateArrete < fin &&
            ` Du ${dateFr(jourSuivant(etat.dateArrete))} au ${dateFr(fin)} : heures et paniers prévus, déplacements comptés le mois prochain en régularisation.`}
        </p>
      </div>

      <div className={`mb-4 rounded-2xl p-4 text-sm shadow-sm ${regul.length ? "bg-amber-50" : "bg-white"}`}>
        <p className="mb-2 font-bold text-slate-900">Régularisations du mois précédent ({nomMois(etat.moisPrecedent)})</p>
        {!etat.regularisationsCalculees ? (
          <p className="text-slate-500">Le mois précédent n&apos;a pas été clôturé avec l&apos;état préparatoire : aucune régularisation calculée.</p>
        ) : regul.length === 0 ? (
          <p className="text-slate-500">Aucun écart entre ce qui a été déclaré et le réel.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {regul.map((l) => (
              <div key={l.salarieId} className="rounded-xl bg-white p-3">
                <p className="mb-1 font-semibold text-slate-900">{l.nom}</p>
                <p className="whitespace-pre-line text-xs text-slate-700">{l.regularisation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left">Nom et Prénom</th>
              <th className="px-2 py-2 text-right">Heures travaillées</th>
              <th className="px-2 py-2 text-right">HS 25 %</th>
              <th className="px-2 py-2 text-right">HS 50 %</th>
              <th className="px-2 py-2 text-left">1er jour (inclus)</th>
              <th className="px-2 py-2 text-left">Dernier jour (inclus)</th>
              <th className="px-2 py-2 text-left">Motif</th>
              <th className="px-2 py-2 text-right">Paniers</th>
              <th className="px-2 py-2 text-right">Montant</th>
              <th className="px-2 py-2 text-right">Trajet</th>
              <th className="px-2 py-2 text-right">Transport</th>
              <th className="px-2 py-2 text-left">Observations</th>
            </tr>
          </thead>
          <tbody>
            {etat.lignes.filter((l) => l.bloc === "technique").map(ligne)}
            <tr>
              <td colSpan={12} className="bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-500">
                Administratifs et cadres
              </td>
            </tr>
            {etat.lignes.filter((l) => l.bloc === "autre").map(ligne)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

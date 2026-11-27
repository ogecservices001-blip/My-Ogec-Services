"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, PhoneCall, ThumbsDown } from "lucide-react";
import type { Tables } from "@/lib/types";
import { useChampManquant } from "@/components/champ-manquant";
import { majSuiviCommercial, marquerDevisPerdu, noterRelance } from "../../actions";
import {
  CHOIX_VALIDITE_MOIS,
  DELAI_RELANCE_MOIS,
  MOTIFS_PERTE,
  ajouterMois,
  aujourdhuiReunion,
  finValidite,
  frDepuisIso,
  libelleValidite,
  type Relance,
} from "@/lib/devis/suivi-commercial";

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";

/// Suivi commercial d'un devis en attente de commande : validité de l'offre,
/// rappel de relance (oui / non, choisi par le bureau), relances faites et
/// « refusé / perdu ».
export function SuiviCommercial({ devis }: { devis: Tables<"devis"> }) {
  const router = useRouter();
  const { signaler, fenetre } = useChampManquant();
  const [pending, startTransition] = useTransition();
  const jour = aujourdhuiReunion();

  const [validite, setValidite] = useState(devis.validite_mois);
  const [rappel, setRappel] = useState(devis.rappel_relance);
  const [dateRappel, setDateRappel] = useState(devis.prochaine_relance ?? ajouterMois(jour, DELAI_RELANCE_MOIS));
  const [note, setNote] = useState("");
  const [perte, setPerte] = useState(false);
  const [motif, setMotif] = useState("");
  const [precision, setPrecision] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const fin = finValidite(devis.date_devis, validite);
  const expiree = Boolean(fin) && fin < jour;
  const relances = (devis.relances as unknown as Relance[] | null) ?? [];
  const modifie =
    validite !== devis.validite_mois ||
    rappel !== devis.rappel_relance ||
    (rappel && dateRappel !== (devis.prochaine_relance ?? ""));

  function executer(action: () => Promise<{ ok: true } | { ok: false; erreur: string; champs?: Record<string, string> }>, apres?: () => void) {
    setErreur(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        const champ = Object.keys(r.champs ?? {})[0];
        if (champ) signaler(r.erreur, champ);
        else setErreur(r.erreur);
        return;
      }
      apres?.();
      router.refresh();
    });
  }

  function enregistrer() {
    executer(() =>
      majSuiviCommercial(devis.id, { validite_mois: validite, rappel_relance: rappel, prochaine_relance: rappel ? dateRappel : null }),
    );
  }

  function relancer() {
    executer(
      () => noterRelance(devis.id, note),
      () => setNote(""),
    );
  }

  function confirmerPerte() {
    if (!motif) return signaler("Choisis le motif", "devis-motif-perte");
    if (motif === "Autre" && !precision.trim()) return signaler("Précise le motif", "devis-precision-perte");
    const texte = motif === "Autre" || precision.trim() ? `${motif} : ${precision.trim()}`.replace(/ : $/, "") : motif;
    executer(
      () => marquerDevisPerdu(devis.id, texte),
      () => setPerte(false),
    );
  }

  if (devis.perdu_le) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-rose-800">
          <ThumbsDown className="h-4 w-4" /> Refusé / perdu le {frDepuisIso(devis.perdu_le)}
        </p>
        <p className="mt-1 text-sm text-rose-800">{devis.motif_perte}</p>
        <p className="mt-2 text-xs text-rose-700">« Remettre en attente » ou « Marquer commandé » le fait revenir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      {fenetre}
      <h2 className="text-sm font-bold text-slate-900">Suivi commercial</h2>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Validité de l&apos;offre</label>
        <select value={validite} onChange={(e) => setValidite(Number(e.target.value))} className={CHAMP}>
          {CHOIX_VALIDITE_MOIS.map((m) => (
            <option key={m} value={m}>
              {libelleValidite(m)}
            </option>
          ))}
        </select>
        {fin && (
          <p className={`mt-1 text-xs font-semibold ${expiree ? "text-red-600" : "text-slate-500"}`}>
            {expiree ? `Offre expirée depuis le ${frDepuisIso(fin)}` : `Valable jusqu'au ${frDepuisIso(fin)}`}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <BellRing className="h-3.5 w-3.5" /> Rappel de relance
        </p>
        <div className="flex gap-2">
          {[
            { valeur: true, label: "Oui" },
            { valeur: false, label: "Non" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setRappel(o.valeur)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                rappel === o.valeur ? "bg-brand-green text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {rappel && (
          <input
            id="devis-prochaine-relance"
            type="date"
            value={dateRappel}
            onChange={(e) => setDateRappel(e.target.value)}
            className={`mt-2 ${CHAMP}`}
          />
        )}
        {devis.rappel_relance && devis.prochaine_relance && devis.prochaine_relance <= jour && (
          <p className="mt-1 text-xs font-semibold text-amber-700">Relance à faire (prévue le {frDepuisIso(devis.prochaine_relance)})</p>
        )}
      </div>

      <button
        onClick={enregistrer}
        disabled={pending || !modifie}
        className="w-full rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-50"
      >
        Enregistrer
      </button>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <PhoneCall className="h-3.5 w-3.5" /> Relances faites ({relances.length})
        </p>
        {relances.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm">
            {relances.map((r, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="font-semibold text-slate-700">{r.date}</span>
                <span className="text-slate-500"> · {r.par}</span>
                {r.note && <p className="text-slate-600">{r.note}</p>}
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Note (facultatif) : appel, réponse du client…"
          className={CHAMP}
        />
        <button
          onClick={relancer}
          disabled={pending}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          J&apos;ai relancé le client
        </button>
        {devis.rappel_relance && (
          <p className="mt-1 text-xs text-slate-500">Le prochain rappel sera repoussé d&apos;un mois.</p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3">
        {!perte ? (
          <button
            onClick={() => setPerte(true)}
            disabled={pending}
            className="w-full rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Refusé / perdu
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">Pourquoi ce devis est-il perdu ?</p>
            <div id="devis-motif-perte" className="flex flex-wrap gap-1.5">
              {MOTIFS_PERTE.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotif(m)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    motif === m ? "bg-rose-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              id="devis-precision-perte"
              value={precision}
              onChange={(e) => setPrecision(e.target.value)}
              placeholder={motif === "Autre" ? "Précise le motif" : "Précision (facultatif)"}
              className={CHAMP}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPerte(false)}
                disabled={pending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmerPerte}
                disabled={pending}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Confirmer refusé / perdu
              </button>
            </div>
          </div>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
    </div>
  );
}

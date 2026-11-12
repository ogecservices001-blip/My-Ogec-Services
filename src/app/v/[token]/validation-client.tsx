"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { repondreDemande, type DemandePublique } from "./actions";
import { estJourOuvre, libelleJours } from "@/lib/planning/periode";

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-100 p-4 sm:items-center">
      <div className="w-full max-w-lg">
        <div className="mb-4 rounded-2xl bg-teal-700 px-5 py-4 text-center text-white shadow-sm">
          <p className="text-lg font-bold">OGEC Services</p>
          <p className="text-sm text-teal-100">Confirmation de notre passage</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ValidationClient({ token, demande }: { token: string; demande: DemandePublique | null }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"choix" | "autre">("choix");
  const [date, setDate] = useState("");
  const [moment, setMoment] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState<"valide" | "autre_date" | null>(null);

  if (!demande) {
    return (
      <Cadre>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <XCircle className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-600">Ce lien n&apos;est pas valide. Merci de nous contacter.</p>
        </div>
      </Cadre>
    );
  }

  const dates = libelleJours(demande.infos.jours);
  const statut = termine ?? demande.statut;
  const demain = demande.demain;
  const dateInvalide = date !== "" && (date < demain || !estJourOuvre(date, demande.joursFeries));

  function repondre(accepte: boolean) {
    setErreur(null);
    if (!accepte) {
      if (!date) return setErreur("Choisissez une date.");
      if (dateInvalide) return setErreur("Choisissez un jour de semaine à venir, hors jour férié.");
    }
    startTransition(async () => {
      const res = await repondreDemande(token, accepte ? { accepte: true } : { accepte: false, date, moment, commentaire });
      if (!res.ok) return setErreur(res.erreur);
      setTermine(accepte ? "valide" : "autre_date");
    });
  }

  return (
    <Cadre>
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm text-slate-700">{demande.nom ? `Bonjour ${demande.nom},` : "Bonjour,"}</p>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Intervention proposée</p>
        <p className="mt-1 font-bold text-slate-900">{[demande.infos.client_nom, demande.infos.site].filter(Boolean).join(" — ")}</p>
        <p className="text-sm text-slate-600">{demande.infos.objet}</p>
        <ul className="mt-3 space-y-1">
          {dates.map((d) => (
            <li key={d} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CalendarClock className="h-4 w-4 text-teal-700" strokeWidth={2} />
              {d}
            </li>
          ))}
        </ul>
      </div>

      {statut === "valide" ? (
        <div className="flex items-start gap-3 rounded-2xl bg-green-50 p-5 shadow-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
          <p className="text-sm text-green-800">
            Merci, votre confirmation est enregistrée. Un accusé de réception vous a été envoyé par mail.
          </p>
        </div>
      ) : statut === "autre_date" ? (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-5 shadow-sm">
          <CalendarCheck className="h-6 w-6 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Merci, votre demande de changement de date est enregistrée. Nous revenons vers vous rapidement pour vous confirmer la nouvelle date.
          </p>
        </div>
      ) : statut === "remplacee" ? (
        <div className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm">
          Cette proposition a été remplacée par une plus récente : merci d&apos;utiliser le lien du dernier mail reçu.
        </div>
      ) : demande.expiree ? (
        <div className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm">
          Cette proposition a expiré. Merci de nous contacter pour convenir d&apos;une nouvelle date.
        </div>
      ) : mode === "choix" ? (
        <div className="space-y-3">
          <button
            onClick={() => repondre(true)}
            disabled={pending}
            className="w-full rounded-xl bg-teal-700 px-4 py-4 text-base font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
          >
            {pending ? "Enregistrement..." : "J'accepte ces dates"}
          </button>
          <button
            onClick={() => setMode("autre")}
            disabled={pending}
            className="w-full rounded-xl bg-white px-4 py-4 text-base font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Proposer une autre date
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-bold text-slate-900">Proposer une autre date</p>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {demande.infos.jours.length > 1 ? `Date de début (intervention sur ${demande.infos.jours.length} jours)` : "Date souhaitée"}
          </label>
          <input
            type="date"
            min={demain}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mb-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base"
          />
          {dateInvalide && <p className="mb-2 text-xs text-red-600">Jour de semaine à venir uniquement, hors jour férié.</p>}
          <label className="mb-1 mt-3 block text-xs font-medium text-slate-600">Moment de la journée (facultatif)</label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              ["", "Indifférent"],
              ["matin", "Matin"],
              ["apres_midi", "Après-midi"],
            ].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMoment(v)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${moment === v ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Commentaire (facultatif)</label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={3}
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMode("choix")}
              disabled={pending}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600"
            >
              Retour
            </button>
            <button
              onClick={() => repondre(false)}
              disabled={pending}
              className="flex-1 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {pending ? "Envoi..." : "Envoyer ma proposition"}
            </button>
          </div>
        </div>
      )}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}
    </Cadre>
  );
}

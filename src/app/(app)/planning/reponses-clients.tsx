"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { accepterDateClient, replanifierDemande, type ConflitDate } from "./validation-actions";
import { libelleJours, type JourDemande } from "@/lib/planning/periode";
import { lundiDeLaSemaine } from "@/lib/planning/dates";

export type ReponseClient = {
  id: string;
  client_nom: string;
  site: string;
  objet: string;
  jours: JourDemande[];
  date_proposee: string;
  moment: string;
  commentaire: string;
  destinataire: string;
  premierCreneauId: string;
};

const dateFr = (d: string) => libelleJours([{ date: d, heure: null }])[0];

/// Demandes où le client a proposé une autre date, à traiter par le bureau.
export function ReponsesClients({ reponses }: { reponses: ReponseClient[] }) {
  if (reponses.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-purple-900">
        <CalendarClock className="h-4 w-4" strokeWidth={2.25} />
        Réponses clients à traiter ({reponses.length})
      </p>
      <div className="space-y-2">
        {reponses.map((r) => (
          <Reponse key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

function Reponse({ r }: { r: ReponseClient }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [conflits, setConflits] = useState<ConflitDate[]>([]);

  function accepter() {
    setErreur(null);
    setConflits([]);
    startTransition(async () => {
      const res = await accepterDateClient(r.id);
      if (!res.ok) {
        setErreur(res.erreur);
        setConflits(res.conflits ?? []);
        return;
      }
      router.refresh();
    });
  }

  function replanifier() {
    startTransition(async () => {
      const res = await replanifierDemande(r.id);
      if (!res.ok) return setErreur(res.erreur);
      router.push(`/planning?semaine=${lundiDeLaSemaine(r.jours[0]?.date)}&creneau=${r.premierCreneauId}`);
    });
  }

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-sm font-bold text-slate-900">
        {r.client_nom} — {r.site} <span className="font-normal text-slate-500">· {r.objet}</span>
      </p>
      <p className="text-sm text-slate-600">
        Proposé : {libelleJours(r.jours).join(", ")} → <strong className="text-purple-800">le client demande à partir du {dateFr(r.date_proposee)}</strong>
        {r.moment && ` (${r.moment === "matin" ? "matin" : "après-midi"})`}
      </p>
      {r.commentaire && <p className="text-sm italic text-slate-500">« {r.commentaire} »</p>}
      <p className="text-xs text-slate-400">Réponse de {r.destinataire}</p>
      {erreur && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-semibold">{erreur}</p>
          {conflits.map((c) => (
            <p key={`${c.date}-${c.technicien}`}>
              {dateFr(c.date)} : {c.technicien} {c.motif}
            </p>
          ))}
          {conflits.length > 0 && <p className="mt-1 text-xs">Replanifie (autre date ou autres techniciens) puis renvoie une demande au client.</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={accepter}
          disabled={pending}
          className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "..." : "Accepter cette date"}
        </button>
        <button
          onClick={replanifier}
          disabled={pending}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Replanifier moi-même
        </button>
      </div>
    </div>
  );
}

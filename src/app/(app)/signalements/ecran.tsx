"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, MessageSquare, Send } from "lucide-react";
import { envoyerSignalement, marquerSignalement } from "./actions";
import type { Signalement, TypeSignalement } from "@/lib/types";

const TYPES: { valeur: TypeSignalement; label: string; icone: typeof Bug }[] = [
  { valeur: "bug", label: "Bug", icone: Bug },
  { valeur: "suggestion", label: "Suggestion", icone: Lightbulb },
  { valeur: "remarque", label: "Remarque", icone: MessageSquare },
];

const LABEL_TYPE: Record<TypeSignalement, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  remarque: "Remarque",
};

const TEINTE_TYPE: Record<TypeSignalement, string> = {
  bug: "bg-red-100 text-red-700",
  suggestion: "bg-amber-100 text-amber-700",
  remarque: "bg-sky-100 text-sky-700",
};

function formaterDateHeure(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SignalementsEcran({
  isAdmin,
  signalements,
}: {
  isAdmin: boolean;
  signalements: Signalement[];
}) {
  const [type, setType] = useState<TypeSignalement>("bug");
  const [message, setMessage] = useState("");
  const [envoi, startEnvoi] = useTransition();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function envoyer() {
    setErreur(null);
    setConfirmation(null);
    startEnvoi(async () => {
      const res = await envoyerSignalement(type, message);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setMessage("");
      setConfirmation("Merci, c'est envoyé au bureau.");
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Signalement retour terrain
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Un bug, une idée, une remarque sur l&apos;appli — dis-le nous.
      </p>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          {TYPES.map(({ valeur, label, icone: Icone }) => (
            <button
              key={valeur}
              onClick={() => setType(valeur)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                type === valeur
                  ? "bg-brand-green text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icone className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Décris ce que tu as remarqué..."
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        {confirmation && (
          <p className="mt-2 text-sm font-medium text-brand-green-dark">{confirmation}</p>
        )}
        <div className="mt-3 flex justify-end">
          <button
            onClick={envoyer}
            disabled={envoi || !message.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            {envoi ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>

      {isAdmin && <ListeAdmin signalements={signalements} />}
    </div>
  );
}

function ListeAdmin({ signalements }: { signalements: Signalement[] }) {
  const [filtre, setFiltre] = useState<"a_traiter" | "traites">("a_traiter");
  const [maj, startMaj] = useTransition();

  const aTraiter = signalements.filter((s) => !s.traite);
  const traites = signalements.filter((s) => s.traite);
  const affiches = filtre === "a_traiter" ? aTraiter : traites;

  function basculer(id: string, traite: boolean) {
    startMaj(() => {
      marquerSignalement(id, traite);
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFiltre("a_traiter")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            filtre === "a_traiter"
              ? "bg-slate-800 text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          À traiter ({aTraiter.length})
        </button>
        <button
          onClick={() => setFiltre("traites")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            filtre === "traites"
              ? "bg-brand-green text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Traités ({traites.length})
        </button>
      </div>

      {affiches.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {filtre === "a_traiter" ? "Aucun signalement en attente" : "Aucun signalement traité"}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {affiches.map((s) => (
            <li key={s.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TEINTE_TYPE[s.type]}`}
                  >
                    {LABEL_TYPE[s.type]}
                  </span>
                  <p className="mt-1.5 text-sm text-slate-800">{s.message}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {s.auteur_nom} · {formaterDateHeure(s.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => basculer(s.id, !s.traite)}
                  disabled={maj}
                  className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  {s.traite ? "Rouvrir" : "Marquer traité"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TypeBadge } from "@/components/signalements/type-badge";
import type { Signalement, SignalementHistorique } from "@/lib/types";
import { marquerSignalement } from "../actions";

function formaterDateHeure(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DetailSignalement({
  signalement,
  journal,
}: {
  signalement: Signalement;
  journal: SignalementHistorique[];
}) {
  const router = useRouter();
  const [maj, startMaj] = useTransition();

  function basculer() {
    startMaj(async () => {
      await marquerSignalement(signalement.id, !signalement.traite);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/signalements"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="font-mono text-lg font-bold text-slate-900">{signalement.numero}</p>
        <TypeBadge type={signalement.type} />
      </div>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-semibold text-slate-900">
          {signalement.menu} › {signalement.sous_menu}
        </p>
        <p className="mt-0.5 text-sm text-slate-700">{signalement.nature}</p>
        {signalement.message && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{signalement.message}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Envoyé par {signalement.auteur_nom} · {formaterDateHeure(signalement.created_at)}
        </p>
      </div>

      <button
        onClick={basculer}
        disabled={maj}
        className={`mb-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition disabled:opacity-60 ${
          signalement.traite
            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
            : "bg-brand-green text-white hover:bg-brand-green-dark"
        }`}
      >
        {maj ? "..." : signalement.traite ? "Rouvrir" : "Marquer traité"}
      </button>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Journal</p>
        <ul className="space-y-1.5">
          {journal.map((h) => (
            <li key={h.id} className="text-sm text-slate-600">
              <span className="text-slate-400">{formaterDateHeure(h.created_at)}</span> · {h.auteur_nom} —{" "}
              {h.action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

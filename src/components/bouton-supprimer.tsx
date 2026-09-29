"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

/// Bouton de suppression avec confirmation dépliée en ligne (pas de
/// popup navigateur) — réutilisable pour n'importe quelle Server
/// Action de suppression déjà liée à son id (`action.bind(null, id)`).
export function BoutonSupprimer({
  action,
  confirmation,
  redirectTo,
  label = "Supprimer",
}: {
  action: () => Promise<ActionResult>;
  confirmation: string;
  redirectTo: string;
  label?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const router = useRouter();

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="mb-3 text-sm text-red-800">{confirmation}</p>
      {erreur && <p className="mb-2 text-sm font-medium text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setOuvert(false)}
          disabled={pending}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Annuler
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await action();
              if (!res.ok) {
                setErreur(res.erreur);
                return;
              }
              router.push(redirectTo);
              router.refresh();
            })
          }
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Suppression..." : "Confirmer la suppression"}
        </button>
      </div>
    </div>
  );
}

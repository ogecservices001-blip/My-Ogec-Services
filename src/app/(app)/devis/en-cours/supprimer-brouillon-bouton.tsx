"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

export function SupprimerBrouillonBouton({
  id,
  supprimer,
}: {
  id: string;
  supprimer: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmer, setConfirmer] = useState(false);

  if (confirmer) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-slate-500">Supprimer ?</span>
        <button
          onClick={() =>
            startTransition(async () => {
              await supprimer(id);
              router.refresh();
            })
          }
          disabled={pending}
          className="rounded-lg bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Oui
        </button>
        <button onClick={() => setConfirmer(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">
          Non
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmer(true)}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
      title="Supprimer ce brouillon"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}

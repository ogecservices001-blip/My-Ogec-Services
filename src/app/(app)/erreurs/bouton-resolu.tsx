"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { marquerIncidentResolu } from "./actions";

export function BoutonResolu({ id }: { id: string }) {
  const router = useRouter();
  const [enCours, start] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        start(async () => {
          const r = await marquerIncidentResolu(id);
          if (r.ok) router.refresh();
          else alert(r.erreur);
        })
      }
      className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      {enCours ? "..." : "Résolu"}
    </button>
  );
}

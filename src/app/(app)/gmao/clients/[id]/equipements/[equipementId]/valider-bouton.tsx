"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { validerEquipement } from "../actions";

export function ValiderBouton({ id, siteId }: { id: string; siteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await validerEquipement(id, siteId);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
    >
      <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
      {pending ? "Validation..." : "Valider cet équipement"}
    </button>
  );
}

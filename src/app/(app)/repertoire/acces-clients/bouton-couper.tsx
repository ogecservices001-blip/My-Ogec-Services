"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { couperAccesClient } from "../clients/[id]/acces-client-actions";

export function BoutonCouper({ siteId, email }: { siteId: string; email: string }) {
  const router = useRouter();
  const [enCours, start] = useTransition();
  return (
    <button
      disabled={enCours}
      onClick={() => {
        if (!confirm(`Couper l'accès de ${email} à ce site ?`)) return;
        start(async () => {
          const r = await couperAccesClient(siteId, email);
          if (!r.ok) alert(r.erreur);
          router.refresh();
        });
      }}
      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      Couper
    </button>
  );
}

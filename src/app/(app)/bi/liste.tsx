"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatutBadge } from "@/components/bi/statut-badge";
import { labelPole } from "@/lib/bi/constants";

type BonResume = {
  id: string;
  numero: string;
  statut: string;
  pole: string;
  client_nom: string;
  site: string;
  updated_at: string;
};

export function BiListe({ bons, titre, vide }: { bons: BonResume[]; titre: string; vide: string }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{titre}</h1>
        <p className="text-sm text-slate-500">Petits travaux, maintenance, dépannage</p>
      </div>

      {bons.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{vide}</p>
      ) : (
        <ul className="space-y-2.5">
          {bons.map((b) => (
            <CarteBon key={b.id} bon={b} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteBon({ bon }: { bon: BonResume }) {
  return (
    <li>
      <Link
        href={`/bi/${bon.id}`}
        className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold text-slate-900">{bon.numero || "BI (brouillon)"}</p>
            <StatutBadge statut={bon.statut} />
          </div>
          <p className="truncate text-sm text-slate-500">
            {[bon.client_nom, bon.site].filter(Boolean).join(" — ")}
          </p>
          <p className="text-xs text-slate-400">
            Pôle {bon.pole} · {labelPole(bon.pole)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </Link>
    </li>
  );
}

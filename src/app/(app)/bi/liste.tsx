"use client";

import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { StatutBadge } from "@/components/bi/statut-badge";
import { Statuts, labelPole } from "@/lib/bi/constants";

type BonResume = {
  id: string;
  numero: string;
  statut: string;
  pole: string;
  client_nom: string;
  site: string;
  updated_at: string;
};

export function BiListe({ bons }: { bons: BonResume[] }) {
  const aVerifier = bons.filter((b) => b.statut === Statuts.aVerifier);
  const autres = bons.filter((b) => b.statut !== Statuts.aVerifier);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Bon d&apos;intervention</h1>
          <p className="text-sm text-slate-500">Petits travaux, maintenance, dépannage</p>
        </div>
        <Link
          href="/bi/nouveau"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Nouveau BI
        </Link>
      </div>

      {bons.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun bon d&apos;intervention pour l&apos;instant</p>
      ) : (
        <>
          {aVerifier.length > 0 && (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-orange-600">
                À vérifier ({aVerifier.length})
              </p>
              <ul className="mb-5 space-y-2.5">
                {aVerifier.map((b) => (
                  <CarteBon key={b.id} bon={b} />
                ))}
              </ul>
            </>
          )}
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Tous les bons</p>
          <ul className="space-y-2.5">
            {autres.map((b) => (
              <CarteBon key={b.id} bon={b} />
            ))}
          </ul>
        </>
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

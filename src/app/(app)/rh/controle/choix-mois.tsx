"use client";

import { useRouter } from "next/navigation";

export function ChoixMois({ mois }: { mois: string }) {
  const router = useRouter();
  return (
    <input
      type="month"
      value={mois}
      onChange={(e) => e.target.value && router.push(`/rh/controle?mois=${e.target.value}`)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
    />
  );
}

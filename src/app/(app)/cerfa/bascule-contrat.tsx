import Link from "next/link";

/// Même bascule Sous contrat / Hors contrat que le reste de l'appli.
export function BasculeContrat({ base, horsContrat }: { base: string; horsContrat: boolean }) {
  const classe = (actif: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      actif ? "bg-brand-green text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
    }`;
  return (
    <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
      <Link href={`${base}?horsContrat=0`} className={classe(!horsContrat)}>
        Sous contrat
      </Link>
      <Link href={`${base}?horsContrat=1`} className={classe(horsContrat)}>
        Hors contrat
      </Link>
    </div>
  );
}

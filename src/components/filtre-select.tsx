"use client";

/// Menu déroulant de filtre au-dessus d'un tableur (même style que les
/// filtres du registre Devis).
export function FiltreSelect({
  valeur,
  onChange,
  options,
  toutes,
}: {
  valeur: string;
  onChange: (v: string) => void;
  options: { valeur: string; label: string }[];
  toutes: string;
}) {
  return (
    <select
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
    >
      <option value="">{toutes}</option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

import type { TypeSignalement } from "@/lib/types";

const LABELS: Record<TypeSignalement, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  remarque: "Remarque",
};

const COULEURS: Record<TypeSignalement, string> = {
  bug: "bg-red-100 text-red-700",
  suggestion: "bg-amber-100 text-amber-700",
  remarque: "bg-sky-100 text-sky-700",
};

export function TypeBadge({ type }: { type: TypeSignalement }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${COULEURS[type]}`}>
      {LABELS[type]}
    </span>
  );
}

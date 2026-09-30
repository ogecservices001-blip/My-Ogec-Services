import { Statuts, labelStatut } from "@/lib/bi/constants";

const COULEURS: Record<string, string> = {
  [Statuts.brouillon]: "bg-slate-100 text-slate-600",
  [Statuts.aVerifier]: "bg-orange-100 text-orange-700",
  [Statuts.valide]: "bg-green-100 text-brand-green-dark",
  [Statuts.pdfGenere]: "bg-blue-100 text-blue-700",
  [Statuts.pretEnvoi]: "bg-blue-100 text-blue-700",
  [Statuts.envoye]: "bg-violet-100 text-violet-700",
  [Statuts.erreurSync]: "bg-red-100 text-red-700",
};

export function StatutBadge({ statut }: { statut: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${COULEURS[statut] ?? "bg-slate-100 text-slate-600"}`}
    >
      {labelStatut(statut)}
    </span>
  );
}

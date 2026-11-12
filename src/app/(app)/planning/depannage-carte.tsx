import Link from "next/link";
import { Clock, Wrench } from "lucide-react";
import type { DepannagePlanning } from "@/lib/planning/depannages";

/// Dépannage sur le planning, en rouge : plein quand le BI est fait, pâle et
/// en pointillés quand il est seulement assigné à ce jour.
export function DepannageCarte({ depannage, lienBi = false }: { depannage: DepannagePlanning; lienBi?: boolean }) {
  const fait = depannage.etat === "fait";
  const contenu = (
    <>
      <p className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${fait ? "text-red-700" : "text-red-500"}`}>
        <Wrench className="h-3 w-3 shrink-0" strokeWidth={2.5} />
        {fait ? "Dépannage" : "Dépannage à faire"}
      </p>
      <p className="truncate text-sm font-semibold text-slate-900">
        {[depannage.client_nom, depannage.site].filter(Boolean).join(" — ")}
      </p>
      {depannage.equipement && <p className="truncate text-xs text-slate-600">{depannage.equipement}</p>}
      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
        {fait && depannage.heures !== null && (
          <>
            <Clock className="h-3 w-3" strokeWidth={2} />
            {String(Math.round(depannage.heures * 100) / 100).replace(".", ",")}h ·{" "}
          </>
        )}
        {depannage.numero}
      </p>
    </>
  );
  const classes = `block w-full rounded-xl border p-3 text-left ${
    fait ? "border-red-300 bg-red-50" : "border-dashed border-red-200 bg-red-50/40"
  }`;
  if (!fait) {
    return (
      <Link href="/depannages" title="Ouvrir Dépannages en cours" className={`${classes} hover:shadow-sm`}>
        {contenu}
      </Link>
    );
  }
  if (lienBi && depannage.biId) {
    return (
      <Link href={`/bi/${depannage.biId}`} className={`${classes} hover:shadow-sm`}>
        {contenu}
      </Link>
    );
  }
  return <div className={classes}>{contenu}</div>;
}

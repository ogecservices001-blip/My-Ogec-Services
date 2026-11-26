import { FileCheck } from "lucide-react";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";
import { etatCerfa } from "@/lib/cerfa/regles";

const COULEURS = {
  a_jour: "border-green-200 bg-green-50 text-green-700",
  bientot: "border-orange-200 bg-orange-50 text-orange-700",
  retard: "border-red-200 bg-red-50 text-red-700",
  jamais: "border-red-200 bg-red-50 text-red-700",
  charge_inconnue: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

const PASTILLES = { a_jour: "🟢", bientot: "🟠", retard: "🔴", jamais: "🔴", charge_inconnue: "⚪" } as const;

/// Repère CERFA d'un équipement soumis (charge > 2 kg, ou charge inconnue).
/// Rien n'est affiché pour un équipement non concerné. `nouvelOnglet` :
/// le CERFA s'ouvre à côté, sans perdre la saisie en cours (BI, relevé).
export function RepereCerfa({
  typeEquipementId,
  champs,
  equipementId,
  avecBouton = false,
  nouvelOnglet = false,
  compact = false,
}: {
  typeEquipementId: string;
  champs: ChampsEnTeteEquipement;
  equipementId?: string;
  avecBouton?: boolean;
  nouvelOnglet?: boolean;
  compact?: boolean;
}) {
  const e = etatCerfa(typeEquipementId, champs);
  if (!e) return null;
  if (compact) {
    return (
      <p className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${COULEURS[e.etat]}`}>
        {PASTILLES[e.etat]} {e.libelle}
      </p>
    );
  }
  const lien = equipementId ? `/cerfa/nouveau?equipementId=${equipementId}${nouvelOnglet ? "&retour=fermer" : ""}` : null;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${COULEURS[e.etat]}`}>
      <span>
        {PASTILLES[e.etat]} Équipement soumis au CERFA — {e.libelle}
      </span>
      {avecBouton && lien && (
        <a
          href={lien}
          target={nouvelOnglet ? "_blank" : undefined}
          rel={nouvelOnglet ? "noopener" : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <FileCheck className="h-3.5 w-3.5" /> Faire le CERFA
        </a>
      )}
    </div>
  );
}

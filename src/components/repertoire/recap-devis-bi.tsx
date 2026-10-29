"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSignature, ClipboardList, Zap, type LucideIcon } from "lucide-react";
import { eur } from "@/lib/bi/format";
import type { RecapDevis, RecapBi, RecapDepannages, LigneRecap } from "@/lib/repertoire/recap";

const STYLE_BOUTON =
  "inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";

function CarteRecap({
  titre,
  icone: Icone,
  groupes,
  isAdmin,
}: {
  titre: string;
  icone: LucideIcon;
  groupes: { label: string; lignes: LigneRecap[] }[];
  isAdmin: boolean;
}) {
  return (
    <div className="mb-4 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2 first:border-t-0">
        <Icone className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.25} />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titre}</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {groupes.map((g) => (
          <div key={g.label} className="px-4 py-2.5">
            <p className="mb-1.5 text-[13px] font-semibold text-slate-600">
              {g.label} <span className="text-slate-400">({g.lignes.length})</span>
            </p>
            {g.lignes.length === 0 ? (
              <p className="text-sm text-slate-300">—</p>
            ) : (
              <ul className="space-y-1">
                {g.lignes.map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <Link href={l.href} className="min-w-0 truncate font-medium text-slate-900 hover:underline">
                      {l.numero} — {l.libelle}
                    </Link>
                    {isAdmin && <span className="shrink-0 text-slate-500">{l.montant !== null ? eur(l.montant) : "—"}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/// Boutons (Devis / Bon d'intervention / Dépannages) à placer dans une
/// ligne de boutons d'action existante (flex-wrap) — à faire déplier,
/// sinon trop d'info d'un coup sur la fiche Répertoire. Les panneaux,
/// en `w-full`, retombent sur leur propre ligne même dans un conteneur
/// flex-wrap. Voir chargerRecapDevis/chargerRecapBI/chargerRecapDepannages
/// (@/lib/repertoire/recap).
export function BoutonsRecapDevisEtBI({
  devis,
  bi,
  depannages,
  isAdmin,
}: {
  devis: RecapDevis;
  bi: RecapBi;
  depannages: RecapDepannages;
  isAdmin: boolean;
}) {
  const [ouvert, setOuvert] = useState<"devis" | "bi" | "depannages" | null>(null);

  return (
    <>
      <button type="button" onClick={() => setOuvert(ouvert === "devis" ? null : "devis")} className={STYLE_BOUTON}>
        <FileSignature className="h-4 w-4" strokeWidth={2} />
        Devis
      </button>
      <button type="button" onClick={() => setOuvert(ouvert === "bi" ? null : "bi")} className={STYLE_BOUTON}>
        <ClipboardList className="h-4 w-4" strokeWidth={2} />
        Bon d&apos;intervention
      </button>
      <button type="button" onClick={() => setOuvert(ouvert === "depannages" ? null : "depannages")} className={STYLE_BOUTON}>
        <Zap className="h-4 w-4" strokeWidth={2} />
        Dépannages
      </button>

      {ouvert === "devis" && (
        <CarteRecap
          titre="Devis"
          icone={FileSignature}
          isAdmin={isAdmin}
          groupes={[
            { label: "À établir", lignes: devis.aEtablir },
            { label: "Envoyé", lignes: devis.envoye },
            { label: "À réaliser", lignes: devis.aRealiser },
            { label: "Réalisés", lignes: devis.realises },
          ]}
        />
      )}
      {ouvert === "bi" && (
        <CarteRecap
          titre="Bon d'intervention"
          icone={ClipboardList}
          isAdmin={isAdmin}
          groupes={[
            { label: "À Classer", lignes: bi.classer },
            { label: "À Facturer", lignes: bi.facturer },
            { label: "Réception Travaux", lignes: bi.receptionTravaux },
            { label: "Maintenance", lignes: bi.maintenance },
          ]}
        />
      )}
      {ouvert === "depannages" && (
        <CarteRecap
          titre="Dépannages"
          icone={Zap}
          isAdmin={isAdmin}
          groupes={[
            { label: "En cours", lignes: depannages.enCours },
            { label: "Traités", lignes: depannages.traitees },
          ]}
        />
      )}
    </>
  );
}

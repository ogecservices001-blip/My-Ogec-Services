import Link from "next/link";
import { FileSignature, ClipboardList, type LucideIcon } from "lucide-react";
import { eur } from "@/lib/bi/format";
import type { RecapDevis, RecapBi, LigneRecap } from "@/lib/repertoire/recap";

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
  const total = groupes.reduce((n, g) => n + g.lignes.length, 0);
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-l-4 border-slate-200/80 border-l-brand-green/40 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-green-50/50 px-4 py-2.5">
        <Icone className="h-3.5 w-3.5 text-brand-green-dark" strokeWidth={2.25} />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titre}</h2>
        <span className="ml-auto text-xs font-semibold text-slate-400">{total}</span>
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

/// Récap Devis + Bon d'intervention pour une fiche Répertoire (client
/// ou site) — visible à tous (techniciens inclus), montants masqués
/// hors admin. Voir chargerRecapDevis/chargerRecapBI (@/lib/repertoire/recap).
export function RecapDevisEtBI({ devis, bi, isAdmin }: { devis: RecapDevis; bi: RecapBi; isAdmin: boolean }) {
  return (
    <>
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
    </>
  );
}

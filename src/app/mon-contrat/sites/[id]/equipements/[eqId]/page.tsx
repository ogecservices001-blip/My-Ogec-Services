import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { equipementsClient } from "@/lib/espace-client/donnees-parc";
import { labelPole } from "@/lib/bi/constants";
import { Poles } from "@/lib/bi/constants";
import { Carte, Vide, jourCourt } from "../../carte";

export const dynamic = "force-dynamic";

const LIBELLE_ENTRETIEN = labelPole(Poles.entretienSousContrat);

export default async function EquipementClientPage({ params }: { params: Promise<{ id: string; eqId: string }> }) {
  const { id, eqId } = await params;
  const { admin, site } = await accesSite(id);
  const equipement = (await equipementsClient(admin, site.id)).find((e) => e.id === eqId);
  if (!equipement) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/mon-contrat/sites/${site.id}/equipements`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Tous les équipements
      </Link>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xl font-bold text-slate-900">{equipement.nom}</p>
        <p className="text-sm text-slate-500">{[equipement.famille, equipement.groupe, equipement.localisation].filter(Boolean).join(" · ")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {equipement.etat && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${equipement.etat.bon ? "bg-[#eef6ec] text-[#3d7a32]" : "bg-red-100 text-red-700"}`}>
              {equipement.etat.libelle} · constaté le {jourCourt(equipement.etat.date)}
            </span>
          )}
          {equipement.prochainControle !== undefined && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Contrôle d&apos;étanchéité : {equipement.prochainControle ? `prochain le ${equipement.prochainControle}` : "à programmer"}
            </span>
          )}
        </div>
      </div>

      <Carte titre="Historique des interventions" icone={History}>
        {equipement.historique.length === 0 ? (
          <Vide>Aucune intervention enregistrée pour cet équipement.</Vide>
        ) : (
          <ul className="divide-y divide-slate-100">
            {equipement.historique.map((h) => (
              <li key={h.biId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-semibold text-slate-800">{jourCourt(h.date)}</p>
                  <p className="text-sm text-slate-500">
                    {h.type} · {h.numero}
                  </p>
                </div>
                <div className="flex gap-2">
                  {h.type === LIBELLE_ENTRETIEN && (
                    <a href={`/mon-contrat/pdf/rapport/${h.biId}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#4f9a41] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#3d7a32]">
                      Rapport
                    </a>
                  )}
                  <a href={`/mon-contrat/pdf/bi/${h.biId}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Bon d&apos;intervention
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}

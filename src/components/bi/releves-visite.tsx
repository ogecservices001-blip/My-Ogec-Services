"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ClipboardList, Pencil } from "lucide-react";
import type { ReferenceHoraire } from "@/lib/gmao/types";
import { groupeEntretien, SANS_GROUPE } from "@/lib/bi/constants";
import {
  chargerFicheReleve,
  etatRelevesEnAttente,
  type FicheReleve,
} from "@/app/(app)/gmao/clients/[id]/equipements/[equipementId]/releve/actions";
import { ReleveForm } from "@/app/(app)/gmao/clients/[id]/equipements/[equipementId]/releve/nouveau/releve-form";

export type EquipementVisite = { id: string; nom: string; groupe: string; localisation: string };

/// BI Entretien sous contrat, étape 2 : les relevés techniques des équipements
/// entretenus, faits ou à faire, saisis sans quitter le BI. Facultatifs : la
/// visite compte même sans relevé, le BI prévient seulement à la transmission.
export function RelevesVisite({
  visite,
  siteId,
  site,
  equipements,
  references,
  nomUtilisateur,
  techniciens,
  onManquants,
}: {
  /// "Visite 1 de 2 — 2026" saisie dans le BI.
  visite: string;
  siteId: string;
  site: { nom: string; site: string };
  equipements: EquipementVisite[];
  references: ReferenceHoraire[];
  nomUtilisateur: string;
  techniciens: string[];
  onManquants: (noms: string[]) => void;
}) {
  const [etat, setEtat] = useState<Record<string, string>>({});
  const [fiche, setFiche] = useState<FicheReleve | null>(null);
  const [chargement, startChargement] = useTransition();
  const [ouvertureId, setOuvertureId] = useState<string | null>(null);

  const tries = useMemo(
    () =>
      [...equipements].sort((a, b) => {
        const ga = groupeEntretien(a.groupe);
        const gb = groupeEntretien(b.groupe);
        if (ga !== gb) return ga === SANS_GROUPE ? 1 : gb === SANS_GROUPE ? -1 : ga.localeCompare(gb, "fr");
        return a.nom.localeCompare(b.nom, "fr", { numeric: true });
      }),
    [equipements],
  );

  const recharger = useCallback(() => {
    startChargement(async () => setEtat(await etatRelevesEnAttente(siteId)));
  }, [siteId]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  useEffect(() => {
    onManquants(tries.filter((e) => !etat[e.id]).map((e) => e.nom));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rappel du parent volontairement hors dépendances
  }, [tries, etat]);

  function ouvrir(equipementId: string) {
    setOuvertureId(equipementId);
    startChargement(async () => {
      const f = await chargerFicheReleve(equipementId);
      setOuvertureId(null);
      setFiche(f);
    });
  }

  if (tries.length === 0) return null;
  const nbFaits = tries.filter((e) => etat[e.id]).length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <ClipboardList className="h-4 w-4" strokeWidth={2} />
          Relevés techniques{visite ? ` — ${visite}` : ""}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            nbFaits === tries.length ? "bg-green-100 text-brand-green-dark" : "bg-amber-100 text-amber-800"
          }`}
        >
          {nbFaits} / {tries.length} faits
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {tries.map((e) => {
          const fonctionnement = etat[e.id];
          return (
            <div key={e.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  <span className="font-normal text-slate-400">{groupeEntretien(e.groupe)} · </span>
                  {e.nom}
                </p>
                {e.localisation && <p className="truncate text-xs text-slate-500">{e.localisation}</p>}
              </div>
              {fonctionnement ? (
                <>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-xs font-bold ${
                      fonctionnement === "Non Fonctionnel" ? "text-red-600" : "text-brand-green-dark"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
                    {fonctionnement}
                  </span>
                  <button
                    type="button"
                    onClick={() => ouvrir(e.id)}
                    disabled={chargement}
                    title="Corriger le relevé"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => ouvrir(e.id)}
                  disabled={chargement}
                  className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                >
                  {ouvertureId === e.id ? "Ouverture..." : "Faire le relevé"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {fiche && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <ReleveForm
              siteId={siteId}
              site={site}
              equipement={fiche.equipement}
              type={fiche.type}
              references={references}
              freqCourante={fiche.freqCourante}
              nomTechInitial={nomUtilisateur}
              nomsTechniciens={techniciens}
              devisEnCours={fiche.devisEnCours}
              depannagesOuverts={fiche.depannagesOuverts}
              releveExistant={fiche.releveExistant}
              onTermine={() => {
                setFiche(null);
                recharger();
              }}
              onFermer={() => setFiche(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

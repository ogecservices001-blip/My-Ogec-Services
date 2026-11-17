"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InfosFacturationDevis } from "@/lib/devis/facturation";
import { confirmerEcartCommande } from "@/app/(app)/devis/commande-client-actions";
import { facturerDevisDepuisBI } from "./actions";

const eur = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " € HT");

/// Section « Facturation du devis » d'un BI fait sur devis (bureau).
/// - en validation : la case et le mois sont pilotés par la vue de
///   correction, le devis passe Facturable juste après la validation ;
/// - BI déjà validé : bouton pour le faire plus tard.
export function BlocFacturationDevis({
  infos,
  biId,
  enValidation,
  termine,
  onTermine,
  mois,
  onMois,
}: {
  infos: InfosFacturationDevis;
  biId: string;
  enValidation: boolean;
  termine?: boolean;
  onTermine?: (v: boolean) => void;
  mois?: string;
  onMois?: (v: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [moisLocal, setMoisLocal] = useState(infos.moisPropose);
  const moisAffiche = enValidation ? (mois ?? "") : moisLocal;
  const changerMois = enValidation ? (onMois ?? (() => {})) : setMoisLocal;

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>) {
    setErreur(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setErreur(r.erreur ?? "Action impossible.");
      router.refresh();
    });
  }

  const lienDevis = (
    <Link href={`/devis/${infos.id}/statut`} className="font-semibold text-violet-700 underline">
      Devis {infos.numero}
    </Link>
  );

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
      <p className="mb-2 text-sm font-bold text-slate-900">Facturation du devis</p>
      <p className="text-sm text-slate-700">
        {lienDevis} — {eur(infos.montant)}
        {infos.montantCommande !== null && <> · commande client {eur(infos.montantCommande)}</>}
      </p>

      {infos.moisFacturation ? (
        <p className="mt-2 inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">
          Devis facturable en {infos.moisFacturation}
          {infos.facturableParBi && ` (depuis le BI ${infos.facturableParBi})`}
        </p>
      ) : (
        <>
          {infos.ecart !== null && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${infos.ecartAConfirmer ? "bg-amber-100 text-amber-900" : "bg-white text-slate-600"}`}>
              Écart entre la commande et le devis : {infos.ecart > 0 ? "+" : ""}
              {eur(infos.ecart)}
              {infos.ecartAConfirmer ? (
                <button
                  id="bi-devis-ecart"
                  onClick={() => agir(() => confirmerEcartCommande(infos.id))}
                  disabled={pending}
                  className="ml-2 rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {pending ? "..." : "Je confirme l'écart"}
                </button>
              ) : (
                " (confirmé)"
              )}
            </div>
          )}

          {infos.blocage ? (
            <p className="mt-2 text-sm font-medium text-amber-700">{infos.blocage}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {enValidation && (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    id="bi-devis-termine"
                    type="checkbox"
                    checked={Boolean(termine)}
                    onChange={(e) => onTermine?.(e.target.checked)}
                    className="h-4 w-4 accent-brand-green"
                  />
                  Ce BI termine le devis : le passer en Facturable
                </label>
              )}
              {(!enValidation || termine) && (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Mois de facturation du devis (MM-AAAA)</label>
                    <input
                      id="bi-devis-mois"
                      value={moisAffiche}
                      onChange={(e) => changerMois(e.target.value)}
                      placeholder="10-2026"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                    />
                  </div>
                  {!enValidation && (
                    <button
                      onClick={() =>
                        infos.ecartAConfirmer
                          ? setErreur("Le montant de la commande diffère du devis : confirme l'écart ci-dessus avant de passer le devis en Facturable.")
                          : agir(() => facturerDevisDepuisBI(biId, moisLocal))
                      }
                      disabled={pending}
                      className="shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
                    >
                      {pending ? "..." : "Passer le devis en Facturable"}
                    </button>
                  )}
                </div>
              )}
              {enValidation && termine && <p className="text-[11px] text-slate-500">Pré-rempli avec le mois de l&apos;intervention. Le devis passe Facturable dès la validation du BI.</p>}
            </div>
          )}
        </>
      )}
      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
    </div>
  );
}

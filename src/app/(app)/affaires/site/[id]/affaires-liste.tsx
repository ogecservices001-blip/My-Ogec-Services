"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import type { Tables, Site } from "@/lib/types";
import { NATURE_AFFAIRE, labelNatureAffaire } from "@/lib/affaires/constants";
import { modifierAffaire, supprimerAffaire, type AffaireInput } from "../../actions";

type Affaire = Tables<"affaires">;

export function AffairesDuSite({
  site,
  affaires,
  isAdmin,
}: {
  site: Site;
  affaires: Affaire[];
  isAdmin: boolean;
}) {
  const [modifiee, setModifiee] = useState<Affaire | null>(null);

  return (
    <div>
      <Link
        href="/affaires"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {[site.nom, site.site].filter(Boolean).join(" — ")}
      </h1>
      <p className="mb-5 text-sm text-slate-500">{affaires.length} affaire(s)</p>

      {affaires.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Aucune affaire pour ce site pour l&apos;instant
        </p>
      ) : (
        <ul className="space-y-3">
          {affaires.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900">
                    {a.numero_devis || "(sans n° de devis)"}
                  </p>
                  {a.nature && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                      {labelNatureAffaire(a.nature)}
                    </span>
                  )}
                </div>
                {a.designation_prestations && (
                  <p className="mt-1 text-sm text-slate-700">{a.designation_prestations}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {a.numero_commande_client && <span>Commande : {a.numero_commande_client}</span>}
                  {a.date_commande_client && <span>du {a.date_commande_client}</span>}
                  {a.email_responsable_contrat && <span>{a.email_responsable_contrat}</span>}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setModifiee(a)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                  title="Modifier"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {modifiee && <ModaleAffaire affaire={modifiee} onClose={() => setModifiee(null)} />}
    </div>
  );
}

function ModaleAffaire({ affaire, onClose }: { affaire: Affaire; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suppression, startSuppression] = useTransition();
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [input, setInput] = useState<AffaireInput>({
    numero_devis: affaire.numero_devis,
    designation_prestations: affaire.designation_prestations,
    email_responsable_contrat: affaire.email_responsable_contrat,
    date_commande_client: affaire.date_commande_client,
    numero_commande_client: affaire.numero_commande_client,
    nature: affaire.nature,
  });

  function champ<K extends keyof AffaireInput>(cle: K, valeur: AffaireInput[K]) {
    setInput((v) => ({ ...v, [cle]: valeur }));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Modifier l&apos;affaire</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Numéro de devis</label>
            <input
              value={input.numero_devis}
              onChange={(e) => champ("numero_devis", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Désignation des prestations</label>
            <textarea
              value={input.designation_prestations}
              onChange={(e) => champ("designation_prestations", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email responsable contrat</label>
            <input
              type="email"
              value={input.email_responsable_contrat}
              onChange={(e) => champ("email_responsable_contrat", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date de commande client</label>
              <input
                value={input.date_commande_client}
                onChange={(e) => champ("date_commande_client", e.target.value)}
                placeholder="jj/mm/aaaa"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Référence commande client</label>
              <input
                value={input.numero_commande_client}
                onChange={(e) => champ("numero_commande_client", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nature (si déjà connue)</label>
            <select
              value={input.nature}
              onChange={(e) => champ("nature", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">— Non précisée —</option>
              {Object.entries(NATURE_AFFAIRE).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

        {confirmerSuppression ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-800">
              Supprimer définitivement l&apos;affaire &quot;{affaire.numero_devis || "(sans n° de devis)"}&quot; ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmerSuppression(false)}
                disabled={suppression}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                disabled={suppression}
                onClick={() =>
                  startSuppression(async () => {
                    const res = await supprimerAffaire(affaire.id);
                    if (!res.ok) {
                      setErreur(res.erreur);
                      return;
                    }
                    onClose();
                    router.refresh();
                  })
                }
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {suppression ? "Suppression..." : "Confirmer"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => setConfirmerSuppression(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              Supprimer
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={pending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    const res = await modifierAffaire(affaire.id, input);
                    if (!res.ok) {
                      setErreur(res.erreur);
                      return;
                    }
                    onClose();
                    router.refresh();
                  })
                }
                disabled={pending}
                className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
              >
                {pending ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

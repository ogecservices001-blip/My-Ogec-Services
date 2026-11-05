"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import type { Tables } from "@/lib/types";
import { NATURES_DEVIS_SELECTIONNABLES } from "@/lib/devis/constants";
import { pavesDuDevis } from "@/lib/devis/paves";
import { modifierDevis, supprimerDevis, type DevisInput } from "../../actions";

type Devis = Tables<"devis">;

export type LiensDevis = { nbCommandes: number; nbBons: number; nbCreneaux: number };

function nombreVersTexte(valeur: number | null): string {
  return valeur === null ? "" : String(valeur).replace(".", ",");
}

/// null = champ vide, undefined = saisie invalide.
function texteVersNombre(texte: string): number | null | undefined {
  const propre = texte.replace(/\s/g, "").replace(",", ".");
  if (!propre) return null;
  const valeur = Number(propre);
  return Number.isFinite(valeur) ? valeur : undefined;
}

export function ModaleDevis({
  devis,
  liens,
  onClose,
}: {
  devis: Devis;
  liens: LiensDevis;
  onClose: () => void;
}) {
  const router = useRouter();
  const verrouPaves = pavesDuDevis(devis).length > 1;
  const [montantTexte, setMontantTexte] = useState(nombreVersTexte(devis.montant));
  const [heuresTexte, setHeuresTexte] = useState(nombreVersTexte(devis.heures_prevues));
  const suppressionBloquee = liens.nbCommandes > 0;
  const liensPerdus = [
    liens.nbBons > 0 ? `Bons d'intervention liés : ${liens.nbBons}` : "",
    liens.nbCreneaux > 0 ? `Créneaux de planning liés : ${liens.nbCreneaux}` : "",
  ].filter(Boolean);
  const [pending, startTransition] = useTransition();
  const [suppression, startSuppression] = useTransition();
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [input, setInput] = useState<DevisInput>({
    numero: devis.numero,
    item: devis.item,
    redacteur: devis.redacteur,
    nature: devis.nature,
    date_devis: devis.date_devis,
    libelle: devis.libelle,
    montant: devis.montant,
    date_commande_client: devis.date_commande_client,
    reference_client: devis.reference_client,
    statut_commande_fournisseur: devis.statut_commande_fournisseur,
    date_mise_a_disposition_fourniture: devis.date_mise_a_disposition_fourniture,
    bi_reference_historique: devis.bi_reference_historique,
    mois_facturation: devis.mois_facturation,
    remarques: devis.remarques,
    debours_materiel_prevu: devis.debours_materiel_prevu,
    heures_prevues: devis.heures_prevues,
    email_responsable_contrat: devis.email_responsable_contrat,
    annule: devis.annule,
  });

  function champ<K extends keyof DevisInput>(cle: K, valeur: DevisInput[K]) {
    setInput((v) => ({ ...v, [cle]: valeur }));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Modifier le devis</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Référence devis</label>
            <input
              value={input.numero}
              onChange={(e) => champ("numero", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Libellé</label>
            <textarea
              value={input.libelle}
              onChange={(e) => champ("libelle", e.target.value)}
              disabled={verrouPaves}
              title={verrouPaves ? "Ce devis a plusieurs pavés, chacun avec son libellé" : undefined}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nature</label>
              <select
                value={input.nature}
                onChange={(e) => champ("nature", e.target.value)}
                disabled={verrouPaves}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">— Non précisée —</option>
                {verrouPaves && <option value={input.nature}>Plusieurs natures</option>}
                {Object.entries(NATURES_DEVIS_SELECTIONNABLES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Montant (€)</label>
              <input
                value={montantTexte}
                onChange={(e) => setMontantTexte(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date devis</label>
              <input
                value={input.date_devis}
                onChange={(e) => champ("date_devis", e.target.value)}
                placeholder="jj/mm/aaaa"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date commande client</label>
              <input
                value={input.date_commande_client}
                onChange={(e) => champ("date_commande_client", e.target.value)}
                placeholder="jj/mm/aaaa (vide = en attente)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Référence client</label>
            <input
              value={input.reference_client}
              onChange={(e) => champ("reference_client", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Heures prévues</label>
              <input
                value={heuresTexte}
                onChange={(e) => setHeuresTexte(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Statut commande fournisseur</label>
              <input
                value={input.statut_commande_fournisseur}
                onChange={(e) => champ("statut_commande_fournisseur", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Remarques</label>
            <textarea
              value={input.remarques}
              onChange={(e) => champ("remarques", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-red-700">
            <input
              type="checkbox"
              checked={input.annule}
              onChange={(e) => champ("annule", e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            Devis annulé
          </label>
        </div>

        {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
        {suppressionBloquee && (
          <p className="mt-3 text-sm text-slate-500">
            Suppression impossible : commandes fournisseur liées à ce devis ({liens.nbCommandes}).
          </p>
        )}

        {confirmerSuppression ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-800">Supprimer définitivement le devis &quot;{devis.numero}&quot; ?</p>
            {liensPerdus.length > 0 && (
              <div className="mb-2 text-sm font-semibold text-red-800">
                <p>Ces éléments seront conservés, mais ne seront plus rattachés à ce devis :</p>
                <ul className="mt-1 list-disc pl-5">
                  {liensPerdus.map((lien) => (
                    <li key={lien}>{lien}</li>
                  ))}
                </ul>
              </div>
            )}
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
                    const res = await supprimerDevis(devis.id);
                    if (!res.ok) {
                      setErreur(res.erreur);
                      return;
                    }
                    router.push("/devis");
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
              disabled={suppressionBloquee}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    const montant = texteVersNombre(montantTexte);
                    const heures = texteVersNombre(heuresTexte);
                    if (montant === undefined || heures === undefined) {
                      setErreur("Montant et heures prévues doivent être des nombres (ex : 12,50).");
                      return;
                    }
                    const res = await modifierDevis(devis.id, { ...input, montant, heures_prevues: heures });
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Tables } from "@/lib/types";
import { labelNatureDevis } from "@/lib/devis/constants";
import {
  changerStatutDevis,
  lierEquipementDevis,
  modifierMoisFacturation,
  type StatutDevisInput,
} from "../../actions";
import { calculerStatutDevis, LABEL_STATUT_DEVIS } from "../../statut";
import { eur } from "../../registre-liste";

type Devis = Tables<"devis">;
type Mode = "choix" | "commander";

export function StatutDevisForm({
  devis,
  site,
  realise,
  equipements,
  commandesFournisseur,
  dateExecution,
  heuresExecutees,
}: {
  devis: Devis;
  site: { nom: string; site: string } | null;
  realise: boolean;
  equipements: { id: string; nom: string; numero_equipement: string }[];
  commandesFournisseur: { id: string; numero: string; fournisseurNom: string }[];
  dateExecution: string;
  heuresExecutees: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choix");
  const [dateCommande, setDateCommande] = useState(devis.date_commande_client);
  const [reference, setReference] = useState(devis.reference_client || "BPA par mail");
  const [equipementId, setEquipementId] = useState(devis.equipement_id ?? "");
  const [moisFacturation, setMoisFacturation] = useState(devis.mois_facturation);
  const [pending, startTransition] = useTransition();
  const [facturationPending, startFacturation] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurFacturation, setErreurFacturation] = useState<string | null>(null);

  function enregistrerFacturation() {
    setErreurFacturation(null);
    startFacturation(async () => {
      const res = await modifierMoisFacturation(devis.id, moisFacturation.trim());
      if (!res.ok) {
        setErreurFacturation(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  function enregistrerEquipement() {
    setErreur(null);
    startTransition(async () => {
      const res = await lierEquipementDevis(devis.id, equipementId || null);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  const statutActuel = LABEL_STATUT_DEVIS[
    calculerStatutDevis({ annule: devis.annule, commande: Boolean(devis.date_commande_client), realise })
  ];

  function appliquer(input: StatutDevisInput) {
    setErreur(null);
    startTransition(async () => {
      const res = await changerStatutDevis(devis.id, input);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push("/devis");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <Link
        href="/devis"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-bold text-slate-900">{devis.numero || "(sans référence)"}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-700">
          {[site?.nom, site?.site].filter(Boolean).join(" — ")}
        </p>
        {devis.libelle && <p className="text-sm text-slate-500">{devis.libelle}</p>}
        <dl className="mt-2 space-y-0.5 text-xs text-slate-500">
          {devis.nature && <p>Nature : {labelNatureDevis(devis.nature)}</p>}
          {devis.date_devis && <p>Date devis : {devis.date_devis}</p>}
          {devis.montant !== null && <p>Montant : {eur(devis.montant)}</p>}
          {devis.heures_prevues !== null && <p>Heures prévues : {devis.heures_prevues}</p>}
        </dl>
        <p className="mt-2 text-xs text-slate-400">Statut actuel : {statutActuel}</p>
      </div>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      {realise ? (
        <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Ce devis est réalisé (le technicien a transmis son bon d&apos;intervention) — il ne peut plus être
          annulé ni remis en attente.
        </p>
      ) : mode === "choix" ? (
        <div className="space-y-2">
          <button
            onClick={() => setMode("commander")}
            disabled={pending}
            className="w-full rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            Marquer commandé
          </button>
          <button
            onClick={() =>
              appliquer({
                date_commande_client: devis.date_commande_client,
                reference_client: devis.reference_client,
                annule: true,
              })
            }
            disabled={pending}
            className="w-full rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            Marquer annulé
          </button>
          <button
            onClick={() =>
              appliquer({
                date_commande_client: "",
                reference_client: devis.reference_client,
                annule: false,
              })
            }
            disabled={pending}
            className="w-full rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            Remettre en attente
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Date de commande client</label>
            <input
              value={dateCommande}
              onChange={(e) => setDateCommande(e.target.value)}
              placeholder="jj/mm/aaaa"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">Référence de commande client</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("choix")}
              disabled={pending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Retour
            </button>
            <button
              onClick={() =>
                appliquer({ date_commande_client: dateCommande, reference_client: reference, annule: false })
              }
              disabled={pending || !dateCommande.trim()}
              className="flex-1 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
            >
              {pending ? "Enregistrement..." : "Valider la commande"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-medium text-slate-600">Équipement concerné (facultatif)</label>
        <select
          value={equipementId}
          onChange={(e) => setEquipementId(e.target.value)}
          disabled={pending}
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        >
          <option value="">— aucun —</option>
          {equipements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom}
              {e.numero_equipement ? ` (${e.numero_equipement})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={enregistrerEquipement}
          disabled={pending || equipementId === (devis.equipement_id ?? "")}
          className="w-full rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          Enregistrer l&apos;équipement
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Commande fournisseur</h2>
        {commandesFournisseur.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {commandesFournisseur.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/commandes-fournisseur/${c.id}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                >
                  <span className="font-semibold text-slate-900">{c.numero}</span>
                  <span className="text-slate-500">{c.fournisseurNom}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/commandes-fournisseur/nouveau?devisId=${devis.id}`}
          className="block w-full rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          + Bon de commande fournisseur
        </Link>
      </div>

      {realise && (
        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Exécution</h2>
          <dl className="space-y-0.5 text-sm text-slate-600">
            <p>Date d&apos;exécution : {dateExecution || "—"}</p>
            <p>Heures exécutées : {heuresExecutees || "—"}</p>
          </dl>
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Mise en facturation</h2>
        <label className="mb-1 block text-xs font-medium text-slate-600">Mois de facturation (MM-AAAA)</label>
        <div className="flex gap-2">
          <input
            value={moisFacturation}
            onChange={(e) => setMoisFacturation(e.target.value)}
            placeholder="10-2026"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
          <button
            onClick={enregistrerFacturation}
            disabled={facturationPending || moisFacturation === devis.mois_facturation}
            className="shrink-0 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            {facturationPending ? "..." : "Enregistrer"}
          </button>
        </div>
        {erreurFacturation && <p className="mt-2 text-xs text-red-600">{erreurFacturation}</p>}
      </div>
    </div>
  );
}

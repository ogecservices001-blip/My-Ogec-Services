"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Tables } from "@/lib/types";
import { changerStatutDevis, type StatutDevisInput } from "../../actions";
import { calculerStatutDevis, LABEL_STATUT_DEVIS } from "../../statut";

type Devis = Tables<"devis">;
type Mode = "choix" | "commander";

export function StatutDevisForm({
  devis,
  site,
  realise,
}: {
  devis: Devis;
  site: { nom: string; site: string } | null;
  realise: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choix");
  const [dateCommande, setDateCommande] = useState(devis.date_commande_client);
  const [reference, setReference] = useState(devis.reference_client || "BPA par mail");
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

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
    </div>
  );
}
